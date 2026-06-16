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
      autoRefreshToken: true,
      storageKey: 'contenline-auth',
    },
  },
);
