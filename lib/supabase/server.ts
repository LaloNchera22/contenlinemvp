import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'contenline-session';

/**
 * Cliente para usar en API routes / server components con el JWT del usuario.
 * Respeta RLS porque adjunta el token del usuario autenticado vía SIWE.
 */
export function createServerClient(accessToken?: string) {
  const token = accessToken ?? cookies().get(SESSION_COOKIE)?.value;

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : undefined,
    },
  );
}
