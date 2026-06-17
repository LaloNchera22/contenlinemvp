'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDisconnect } from 'wagmi';
import { useSiweAuth } from '@/lib/useSiweAuth';
import ConfirmDialog from '@/app/components/ConfirmDialog';
import EmailNotificationsSection from './EmailNotificationsSection';

export default function SettingsPage() {
  const router = useRouter();
  const { signOut } = useSiweAuth();
  const { disconnect } = useDisconnect();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function doLogout() {
    setConfirmLogout(false);
    await signOut();
    disconnect();
    router.push('/');
  }

  async function doDelete() {
    setConfirmDelete(false);
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/me', { method: 'DELETE' });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.error || 'No se pudo eliminar la cuenta.');
        return;
      }
      // La cuenta quedó anonimizada y la sesión cerrada server-side; desconectamos
      // la wallet en el cliente y volvemos al inicio.
      disconnect();
      router.push('/');
    } catch {
      setError('Error de red al eliminar la cuenta.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Ajustes</h1>

      <div className="card mt-6">
        <h2 className="font-semibold">Sesión</h2>
        <p className="text-sm text-white/60 mt-1">
          Cierra la sesión en este dispositivo. Tu wallet seguirá siendo tuya.
        </p>
        <button onClick={() => setConfirmLogout(true)} className="btn-ghost mt-3">
          Cerrar sesión
        </button>
      </div>

      <EmailNotificationsSection />

      <div className="card mt-6 border-red-500/30">
        <h2 className="font-semibold text-red-400">Eliminar mi cuenta</h2>
        <p className="text-sm text-white/70 mt-2">
          Anonimizamos tus datos personales (nombre, bio, avatar) y liberamos tu
          nombre de usuario. Tus API keys se desactivan de inmediato.
        </p>
        <p className="text-sm text-white/60 mt-2">
          <strong>Qué permanece:</strong> las transacciones registradas onchain son
          inmutables y se conservan por obligaciones contables/fiscales; tu wallet es
          un identificador pseudónimo ya público en la blockchain.
        </p>
        <button onClick={() => setConfirmDelete(true)} disabled={busy}
          className="btn bg-red-600 hover:bg-red-700 text-white mt-4">
          {busy ? 'Procesando…' : 'Eliminar mi cuenta'}
        </button>
        {error && <p className="text-sm text-red-400 mt-3" role="alert">{error}</p>}
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="Cerrar sesión"
        description="Tendrás que volver a firmar con tu wallet para entrar al dashboard."
        confirmText="Cerrar sesión"
        onCancel={() => setConfirmLogout(false)}
        onConfirm={doLogout}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar mi cuenta"
        danger
        confirmText="Eliminar cuenta"
        requireTypeConfirmation="ELIMINAR"
        description={
          <>
            Esta acción anonimiza tu perfil y desactiva tus API keys de forma
            permanente. Las transacciones onchain NO se eliminan. Escribe
            <strong> ELIMINAR</strong> para confirmar.
          </>
        }
        onCancel={() => setConfirmDelete(false)}
        onConfirm={doDelete}
      />
    </div>
  );
}
