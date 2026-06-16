'use client';

import { createClient } from '@supabase/supabase-js';

/**
 * Cliente para el browser. Usa la anon key — RLS protege los datos.
 * El JWT emitido tras SIWE se inyecta vía setSession en el provider.
 */
export const supabaseBrowser = createClient(
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
      storageKey: 'contenline-auth',
    },
  },
);
