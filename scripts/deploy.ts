import { ethers } from 'hardhat';

/**
 * Despliega los contratos en la red seleccionada (Mumbai primero).
 *   npx hardhat run scripts/deploy.ts --network mumbai
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);

  const usdc =
    process.env.NEXT_PUBLIC_USDC_POLYGON ??
    '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
  const feeRecipient = process.env.FEE_RECIPIENT ?? deployer.address;

  const Subscription = await ethers.getContractFactory('ContenlineSubscription');
  const subscription = await Subscription.deploy(usdc, feeRecipient);
  await subscription.waitForDeployment();
  console.log('ContenlineSubscription:', await subscription.getAddress());

  const Payment = await ethers.getContractFactory('ContenlinePayment');
  const payment = await Payment.deploy(usdc, feeRecipient);
  await payment.waitForDeployment();
  console.log('ContenlinePayment:', await payment.getAddress());

  console.log('\nActualiza tu .env:');
  console.log(`NEXT_PUBLIC_CONTRACT_SUBSCRIPTION=${await subscription.getAddress()}`);
  console.log(`NEXT_PUBLIC_CONTRACT_PAYMENT=${await payment.getAddress()}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
