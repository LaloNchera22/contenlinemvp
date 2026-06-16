import { randomBytes } from 'crypto';

export const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutos

export function generateNonce(): string {
  return randomBytes(24).toString('hex');
}

/**
 * Construye el mensaje SIWE que el usuario firma. El formato es estable
 * para que el backend pueda reconstruirlo y verificar la firma con viem.
 */
export function buildSiweMessage(params: {
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
}): string {
  return [
    'Contenline quiere que inicies sesión con tu cuenta de Ethereum.',
    `Nonce: ${params.nonce}`,
    `Emitido en: ${params.issuedAt.toISOString()}`,
    `Expira en: ${params.expiresAt.toISOString()}`,
  ].join('\n');
}
