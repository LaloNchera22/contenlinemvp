'use client';

import { useState, useCallback } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { supabaseBrowser } from '@/lib/supabase/client';

/**
 * Hook que ejecuta el flujo SIWE completo:
 *  nonce → firma → verify → setSession en Supabase.
 */
export function useSiweAuth() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    if (!address) {
      setError('Conecta tu wallet primero');
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      // 1. Pedir nonce + mensaje.
      const nonceRes = await fetch('/api/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address }),
      });
      if (!nonceRes.ok) throw new Error('No se pudo obtener el nonce');
      const { nonce, message } = await nonceRes.json();

      // 2. Firmar el mensaje SIWE.
      const signature = await signMessageAsync({ message });

      // 3. Verificar firma → JWT.
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, nonce, signature }),
      });
      if (!verifyRes.ok) {
        const { error } = await verifyRes.json();
        throw new Error(error ?? 'Verificación fallida');
      }
      const { token, user } = await verifyRes.json();

      // 4. Inyectar el JWT en el cliente Supabase (para RLS desde el browser).
      //    refresh_token vacío a propósito: nuestro JWT no es un refresh token de
      //    Supabase. La renovación la hace refresh() contra /api/auth/refresh.
      await supabaseBrowser.auth.setSession({ access_token: token, refresh_token: '' });

      return { token, user };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de autenticación');
      return null;
    } finally {
      setLoading(false);
    }
  }, [address, signMessageAsync]);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/auth/refresh', { method: 'POST' });
    if (!res.ok) return null;
    const { token, user } = await res.json();
    await supabaseBrowser.auth.setSession({ access_token: token, refresh_token: '' });
    return { token, user };
  }, []);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    await supabaseBrowser.auth.signOut();
  }, []);

  return { signIn, signOut, refresh, loading, error };
}
