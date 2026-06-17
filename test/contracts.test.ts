import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';

const TWO_DAYS = 48 * 60 * 60;

/**
 * Tests básicos de los contratos usando un mock de USDC (ERC20 con 6 decimales).
 */
describe('Contenline contracts', () => {
  async function deployMockUsdc() {
    const Mock = await ethers.getContractFactory('MockUSDC');
    const usdc = await Mock.deploy();
    await usdc.waitForDeployment();
    return usdc;
  }

  it('ContenlineSubscription cobra 10% de fee y registra expiración', async () => {
    const [owner, creator, subscriber, feeRecipient] = await ethers.getSigners();
    const usdc = await deployMockUsdc();

    const Subscription = await ethers.getContractFactory('ContenlineSubscription');
    const sub = await Subscription.deploy(await usdc.getAddress(), feeRecipient.address);
    await sub.waitForDeployment();

    const amount = 100_000_000n; // 100 USDC (6 decimales)
    await usdc.mint(subscriber.address, amount);
    await usdc.connect(subscriber).approve(await sub.getAddress(), amount);

    // El creador registra el plan onchain (precio y duración no los elige el suscriptor).
    await sub.connect(creator).setPlan(1, amount, 30, true);
    await sub.connect(subscriber).subscribe(creator.address, 1);

    expect(await usdc.balanceOf(creator.address)).to.equal(90_000_000n); // 90%
    expect(await usdc.balanceOf(feeRecipient.address)).to.equal(10_000_000n); // 10%

    const [active] = await sub.isSubscribed(subscriber.address, creator.address);
    expect(active).to.equal(true);
  });

  it('ContenlineSubscription rechaza suscripción a plan inexistente/inactivo', async () => {
    const [, creator, subscriber, feeRecipient] = await ethers.getSigners();
    const usdc = await deployMockUsdc();

    const Subscription = await ethers.getContractFactory('ContenlineSubscription');
    const sub = await Subscription.deploy(await usdc.getAddress(), feeRecipient.address);
    await sub.waitForDeployment();

    await usdc.mint(subscriber.address, 100_000_000n);
    await usdc.connect(subscriber).approve(await sub.getAddress(), 100_000_000n);

    // Sin plan registrado: no se puede suscribir por un monto arbitrario.
    await expect(
      sub.connect(subscriber).subscribe(creator.address, 1),
    ).to.be.revertedWith('plan inactive');
  });

  it('ContenlinePayment previene replay del mismo sessionId', async () => {
    const [, creator, payer, feeRecipient] = await ethers.getSigners();
    const usdc = await deployMockUsdc();

    const Payment = await ethers.getContractFactory('ContenlinePayment');
    const pay = await Payment.deploy(await usdc.getAddress(), feeRecipient.address);
    await pay.waitForDeployment();

    const amount = 50_000_000n;
    await usdc.mint(payer.address, amount * 2n);
    await usdc.connect(payer).approve(await pay.getAddress(), amount * 2n);

    await pay.connect(payer).pay(creator.address, 'sess_1', 1, amount); // service 3%
    expect(await usdc.balanceOf(feeRecipient.address)).to.equal(1_500_000n); // 3%

    await expect(
      pay.connect(payer).pay(creator.address, 'sess_1', 1, amount),
    ).to.be.revertedWith('session already processed');
  });

  it('Subscription: setFeeBps requiere propuesta previa y 48h de timelock', async () => {
    const [, , , feeRecipient] = await ethers.getSigners();
    const usdc = await deployMockUsdc();
    const Subscription = await ethers.getContractFactory('ContenlineSubscription');
    const sub = await Subscription.deploy(await usdc.getAddress(), feeRecipient.address);
    await sub.waitForDeployment();

    // Sin propuesta no se puede ejecutar.
    await expect(sub.setFeeBps(500)).to.be.revertedWith('no proposal');

    // Propuesta + ejecución antes de las 48h: revertida.
    await expect(sub.proposeFeeBps(500)).to.emit(sub, 'FeeUpdateProposed');
    await expect(sub.setFeeBps(500)).to.be.revertedWith('timelock not elapsed');

    // Tras el delay, se ejecuta y aplica.
    await time.increase(TWO_DAYS);
    await expect(sub.setFeeBps(500)).to.emit(sub, 'FeeUpdateExecuted');
    expect(await sub.feeBps()).to.equal(500n);
  });

  it('Subscription: no se puede ejecutar un valor distinto al propuesto', async () => {
    const [, , , feeRecipient] = await ethers.getSigners();
    const usdc = await deployMockUsdc();
    const Subscription = await ethers.getContractFactory('ContenlineSubscription');
    const sub = await Subscription.deploy(await usdc.getAddress(), feeRecipient.address);
    await sub.waitForDeployment();

    await sub.proposeFeeBps(500);
    await time.increase(TWO_DAYS);
    // El actionId está atado al valor: ejecutar otro fee no tiene propuesta válida.
    await expect(sub.setFeeBps(700)).to.be.revertedWith('no proposal');
  });

  it('Subscription: solo el owner puede proponer cambios de fee', async () => {
    const [, , attacker, feeRecipient] = await ethers.getSigners();
    const usdc = await deployMockUsdc();
    const Subscription = await ethers.getContractFactory('ContenlineSubscription');
    const sub = await Subscription.deploy(await usdc.getAddress(), feeRecipient.address);
    await sub.waitForDeployment();

    await expect(sub.connect(attacker).proposeFeeBps(500)).to.be.revertedWithCustomError(
      sub,
      'OwnableUnauthorizedAccount',
    );
  });

  it('Payment: setFeeRecipient respeta el timelock de 48h', async () => {
    const [, , newRecipient, feeRecipient] = await ethers.getSigners();
    const usdc = await deployMockUsdc();
    const Payment = await ethers.getContractFactory('ContenlinePayment');
    const pay = await Payment.deploy(await usdc.getAddress(), feeRecipient.address);
    await pay.waitForDeployment();

    await pay.proposeFeeRecipient(newRecipient.address);
    await expect(pay.setFeeRecipient(newRecipient.address)).to.be.revertedWith(
      'timelock not elapsed',
    );

    await time.increase(TWO_DAYS);
    await pay.setFeeRecipient(newRecipient.address);
    expect(await pay.feeRecipient()).to.equal(newRecipient.address);
  });
});
