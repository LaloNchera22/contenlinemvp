import { randomBytes } from 'crypto';

export const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutos

export function generateNonce(): string {
  return randomBytes(24).toString('hex');
}

/**
 * Construye el mensaje SIWE que el usuario firma. El formato es estable
 * para que el backend pueda reconstruirlo y verificar la firma con viem.
 *
 * Incluye dominio, address y chain id (espíritu de EIP-4361): sin el binding
 * de dominio, un sitio malicioso podría pedir un nonce para la wallet de la
 * víctima, hacerle firmar un texto genérico en OTRO contexto y usar esa firma
 * para iniciar sesión aquí. El dominio y la address en el texto hacen visible
 * en la wallet para qué sitio y qué cuenta se firma, y el backend los fija
 * server-side al reconstruir el mensaje (no los controla el caller).
 */
export function buildSiweMessage(params: {
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
  address: string;
}): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  let domain = 'localhost:3000';
  try {
    domain = new URL(appUrl).host;
  } catch {
    // NEXT_PUBLIC_APP_URL malformada: se mantiene el fallback.
  }
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID ?? '137';
  return [
    `${domain} quiere que inicies sesión con tu cuenta de Ethereum:`,
    params.address,
    '',
    `Nonce: ${params.nonce}`,
    `Chain ID: ${chainId}`,
    `Emitido en: ${params.issuedAt.toISOString()}`,
    `Expira en: ${params.expiresAt.toISOString()}`,
  ].join('\n');
}
