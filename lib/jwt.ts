import crypto from 'crypto';

/**
 * Firma un JWT HS256 compatible con Supabase usando SUPABASE_JWT_SECRET.
 * El claim `wallet` se usa en las políticas RLS: auth.jwt() ->> 'wallet'.
 */
function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export interface SessionClaims {
  sub: string; // user id (uuid)
  wallet: string;
  role: 'authenticated';
}

export function signSupabaseJwt(claims: SessionClaims, expiresInSeconds = 60 * 60 * 24 * 7): string {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error('Falta SUPABASE_JWT_SECRET');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    ...claims,
    aud: 'authenticated',
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = base64url(
    crypto.createHmac('sha256', secret).update(data).digest(),
  );

  return `${data}.${signature}`;
}

export function verifySupabaseJwt(token: string): (SessionClaims & { exp: number }) | null {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error('Falta SUPABASE_JWT_SECRET');

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, signature] = parts;

  const expected = base64url(
    crypto.createHmac('sha256', secret).update(`${encodedHeader}.${encodedPayload}`).digest(),
  );
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64').toString('utf8'),
    );
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
