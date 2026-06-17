import { ethers } from 'hardhat';

/**
 * Despliegue de mainnet: igual que deploy.ts pero transfiere la propiedad de ambos
 * contratos a un multisig (Gnosis Safe) inmediatamente después del deploy, y VERIFICA
 * que el owner resultante sea efectivamente el multisig antes de terminar.
 *
 *   MULTISIG_ADDRESS=0xSafe... npx hardhat run scripts/deploy-with-multisig.ts --network polygon
 *
 * Por qué un script separado y no un flag en deploy.ts: el deploy de mainnet NO debe
 * dejar nunca la EOA del deployer como owner (una sola llave comprometida podría
 * mover fees). Hacerlo explícito y con verificación dura evita ese error operativo.
 */
async function main() {
  const multisig = process.env.MULTISIG_ADDRESS;
  if (!multisig || !ethers.isAddress(multisig)) {
    throw new Error('MULTISIG_ADDRESS no es una dirección válida');
  }

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  console.log('Multisig (futuro owner):', multisig);

  const usdc =
    process.env.NEXT_PUBLIC_USDC_POLYGON ?? '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
  const feeRecipient = process.env.FEE_RECIPIENT ?? multisig;

  const Subscription = await ethers.getContractFactory('ContenlineSubscription');
  const subscription = await Subscription.deploy(usdc, feeRecipient);
  await subscription.waitForDeployment();
  const subAddr = await subscription.getAddress();
  console.log('ContenlineSubscription:', subAddr);

  const Payment = await ethers.getContractFactory('ContenlinePayment');
  const payment = await Payment.deploy(usdc, feeRecipient);
  await payment.waitForDeployment();
  const payAddr = await payment.getAddress();
  console.log('ContenlinePayment:', payAddr);

  // Transferir ownership al multisig.
  await (await subscription.transferOwnership(multisig)).wait();
  await (await payment.transferOwnership(multisig)).wait();

  // Verificación dura: si el owner no quedó en el multisig, abortamos con error
  // (no queremos un deploy de mainnet "a medias" pasando por bueno).
  const subOwner = await subscription.owner();
  const payOwner = await payment.owner();
  if (subOwner.toLowerCase() !== multisig.toLowerCase()) {
    throw new Error(`Subscription owner=${subOwner}, esperado ${multisig}`);
  }
  if (payOwner.toLowerCase() !== multisig.toLowerCase()) {
    throw new Error(`Payment owner=${payOwner}, esperado ${multisig}`);
  }

  console.log('\n✓ Ownership transferida y verificada al multisig.');
  console.log('\nActualiza tu .env:');
  console.log(`NEXT_PUBLIC_CONTRACT_SUBSCRIPTION=${subAddr}`);
  console.log(`NEXT_PUBLIC_CONTRACT_PAYMENT=${payAddr}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
