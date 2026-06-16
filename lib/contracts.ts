import { Address } from 'viem';

/** Direcciones oficiales whitelisteadas. Solo estos contratos se aceptan al confirmar tx. */
export const CONTRACTS = {
  subscription: (process.env.NEXT_PUBLIC_CONTRACT_SUBSCRIPTION ?? '') as Address,
  payment: (process.env.NEXT_PUBLIC_CONTRACT_PAYMENT ?? '') as Address,
  usdc: (process.env.NEXT_PUBLIC_USDC_POLYGON ??
    '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174') as Address,
};

export function isWhitelistedContract(address: string): boolean {
  const whitelist = [CONTRACTS.subscription, CONTRACTS.payment].filter(Boolean);

  // Fallar ruidosamente en vez de silenciosamente: una whitelist vacía
  // significa que el entorno no está configurado. Rechazar todo en ese estado
  // es correcto, pero debe ser un error explícito (500) y no un "contrato no
  // autorizado" (400) engañoso que oculte un despliegue mal configurado.
  if (whitelist.length === 0) {
    throw new Error(
      'Whitelist de contratos vacía: configura NEXT_PUBLIC_CONTRACT_SUBSCRIPTION y NEXT_PUBLIC_CONTRACT_PAYMENT',
    );
  }

  const target = address.toLowerCase();
  return whitelist.map((a) => a.toLowerCase()).includes(target);
}

/** ABI mínima de los eventos que verificamos onchain. */
export const PAYMENT_EVENT_ABI = [
  {
    type: 'event',
    name: 'PaymentCompleted',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'sessionId', type: 'string', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'fee', type: 'uint256', indexed: false },
      { name: 'category', type: 'uint8', indexed: false },
    ],
  },
] as const;

export const SUBSCRIPTION_EVENT_ABI = [
  {
    type: 'event',
    name: 'Subscribed',
    inputs: [
      { name: 'subscriber', type: 'address', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'planId', type: 'uint256', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'fee', type: 'uint256', indexed: false },
      { name: 'expiresAt', type: 'uint256', indexed: false },
    ],
  },
] as const;
