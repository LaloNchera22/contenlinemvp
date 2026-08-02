/**
 * AdieCoin platform fees by category.
 *
 * Settlement happens in AUSD (AdieCoin's internal stablecoin unit, pegged 1:1 to
 * deposited USDC). `subscription` / `course` / `service` fees are charged when
 * the internal ledger moves funds from a fan to a creator; `onchain` applies to
 * the deposit → AUSD on-ramp; `challenge` applies when a fan-authored challenge
 * is fulfilled and its staked AUSD is released to the creator.
 *
 * The onchain deposit/subscription contracts replicate the same math
 * (contracts/AdieCoinSubscription.sol and contracts/AdieCoinPayment.sol).
 */
export const FEE_CONFIG = {
  subscription: 0.1, // 10%
  course: 0.1, // 10%
  onchain: 0.03, // 3%
  service: 0.03, // 3%
  challenge: 0.05, // 5% — fan-authored challenges/commissions
} as const;

export type FeeCategory = keyof typeof FEE_CONFIG;

export interface FeeBreakdown {
  feePercent: number;
  feeAmount: number;
  netAmount: number;
}

export function calculateFee(amount: number, category: FeeCategory): FeeBreakdown {
  const feePercent = FEE_CONFIG[category];
  const feeAmount = round6(amount * feePercent);
  const netAmount = round6(amount - feeAmount);
  return { feePercent, feeAmount, netAmount };
}

/** AUSD/USDC both use 6 decimals; avoid floating-point drift. */
function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
