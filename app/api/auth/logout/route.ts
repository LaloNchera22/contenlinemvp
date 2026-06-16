import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** POST /api/auth/logout — invalida la sesión borrando la cookie. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
