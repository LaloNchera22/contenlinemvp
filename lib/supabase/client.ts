'use client';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/**
 * Cliente para el browser. Usa la anon key — RLS protege los datos.
 * El JWT emitido tras SIWE se inyecta vía setSession en el provider.
 *
 * Se instancia de forma LAZY (no a nivel de módulo): durante `next build`,
 * el prerender de las páginas que importan este módulo se ejecuta sin las env
 * vars públicas y `createClient` a nivel de módulo rompía el build entero con
 * "supabaseUrl is required". En el browser real siempre hay env (inyectadas
 * en el bundle), así que el getter nunca falla en runtime.
 */
export function getSupabaseBrowser(): SupabaseClient {
  if (!cached) {
    cached = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          // El JWT lo emitimos nosotros tras SIWE; NO es un par access/refresh de
          // Supabase. Con autoRefreshToken activo, Supabase intentaría refrescar
          // usando el access_token como refresh_token y entraría en un loop de
          // reintentos fallidos. La renovación se hace vía /api/auth/refresh.
          autoRefreshToken: false,
          storageKey: 'adiecoin-auth',
        },
      },
    );
  }
  return cached;
}
