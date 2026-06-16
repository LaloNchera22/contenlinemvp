import crypto from 'crypto';

export type ApiKeyEnvironment = 'production' | 'test';

export interface GeneratedApiKey {
  /** Clave completa en texto plano. Se muestra al usuario UNA sola vez. */
  fullKey: string;
  /** Primeros 12 caracteres, guardados en texto plano para identificación. */
  prefix: string;
  /** SHA-256 de la clave completa, lo único persistido. */
  hash: string;
  environment: ApiKeyEnvironment;
}

/**
 * Genera una API key estilo Stripe: sk_prod_xxx / sk_test_xxx.
 * Sólo el hash y el prefix se guardan en DB.
 */
export function generateApiKey(environment: ApiKeyEnvironment): GeneratedApiKey {
  const tag = environment === 'production' ? 'prod' : 'test';
  const secret = crypto.randomBytes(24).toString('base64url');
  const fullKey = `sk_${tag}_${secret}`;
  return {
    fullKey,
    prefix: fullKey.slice(0, 12),
    hash: hashApiKey(fullKey),
    environment,
  };
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function detectEnvironment(key: string): ApiKeyEnvironment | null {
  if (key.startsWith('sk_prod_')) return 'production';
  if (key.startsWith('sk_test_')) return 'test';
  return null;
}
