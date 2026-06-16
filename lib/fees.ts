/**
 * Comisiones de Contenline por categoría.
 * Este mismo cálculo está replicado en los smart contracts
 * (ContenlineSubscription.sol y ContenlinePayment.sol).
 */
export const FEE_CONFIG = {
  subscription: 0.1, // 10%
  course: 0.1, // 10%
  onchain: 0.03, // 3%
  service: 0.03, // 3%
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

/** USDC tiene 6 decimales; evitamos errores de coma flotante. */
function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
