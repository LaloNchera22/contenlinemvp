import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { SESSION_COOKIE } from './supabase/server';
import { verifySupabaseJwt, SessionClaims } from './jwt';

/**
 * Resuelve el usuario autenticado a partir del JWT de sesión
 * (cookie httpOnly o header Authorization). Devuelve null si no es válido.
 */
export function getSessionFromRequest(req?: NextRequest): (SessionClaims & { token: string }) | null {
  let token: string | undefined;

  const authHeader = req?.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }
  if (!token) {
    token = cookies().get(SESSION_COOKIE)?.value;
  }
  if (!token) return null;

  const claims = verifySupabaseJwt(token);
  if (!claims) return null;

  return { ...claims, token };
}
