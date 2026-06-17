'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useToast } from '@/app/components/Toast';

/**
 * Mantiene coherente la wallet conectada (wagmi) con la sesión de la cookie.
 *
 * Problema que resuelve: la sesión vive en una cookie httpOnly emitida tras SIWE,
 * pero el usuario puede desconectar o cambiar de wallet en su extensión sin que el
 * backend se entere. Eso deja una sesión "huérfana" atada a una wallet que ya no
 * controla el navegador. Aquí detectamos ese desfase y cerramos sesión.
 *
 * Cuidado con el flicker de reconexión: al cargar, wagmi pasa por
 * 'connecting'/'reconnecting' con address indefinida antes de restaurar la wallet.
 * Si actuáramos en ese estado cerraríamos sesión por error en cada recarga, así que
 * solo comparamos cuando el estado ya está asentado.
 */
export function useAuthSync() {
  const { address, status } = useAccount();
  const router = useRouter();
  const toast = useToast();
  // Evita disparar el logout más de una vez mientras la navegación se resuelve.
  const loggingOut = useRef(false);

  useEffect(() => {
    if (status === 'connecting' || status === 'reconnecting') return;
    if (loggingOut.current) return;

    let cancelled = false;
    (async () => {
      const res = await fetch('/api/me');
      // 401 = no hay sesión que sincronizar; cualquier otro error: no arriesgamos
      // un logout por un fallo transitorio de red.
      if (!res.ok) return;
      const { user } = await res.json().catch(() => ({ user: null }));
      const sessionWallet = user?.wallet?.toLowerCase();
      if (!sessionWallet) return;

      const current = address?.toLowerCase();
      // Wallet desconectada o distinta de la de la sesión → la cookie está huérfana.
      if (!current || current !== sessionWallet) {
        loggingOut.current = true;
        await fetch('/api/auth/logout', { method: 'POST' });
        await supabaseBrowser.auth.signOut();
        if (cancelled) return;
        toast.info('Sesión cerrada al desconectar wallet');
        router.push('/');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, status, router, toast]);
}
