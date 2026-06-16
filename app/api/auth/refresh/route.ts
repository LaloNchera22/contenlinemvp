import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { signSupabaseJwt } from '@/lib/jwt';
import { SESSION_COOKIE } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * POST /api/auth/refresh
 *
 * Renueva el JWT de sesión si el actual todavía es válido. Sustituye al
 * (roto) auto-refresh de Supabase, que intentaba usar el access_token como
 * refresh_token y fallaba al expirar. Aquí, mientras la cookie httpOnly siga
 * siendo válida, reemitimos un JWT con nuevo `exp` y refrescamos la cookie.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Sesión inválida o expirada' }, { status: 401 });
  }

  const token = signSupabaseJwt({
    sub: session.sub,
    wallet: session.wallet,
    role: 'authenticated',
  });

  const res = NextResponse.json({
    token,
    user: { id: session.sub, wallet: session.wallet },
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
