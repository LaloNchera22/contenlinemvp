import { expect } from 'chai';
import { ethers } from 'hardhat';

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
});
