'use client';

import { useState } from 'react';

/**
 * Public "send a challenge" form on a creator's profile. A fan authors a paid
 * challenge/commission, staking AUSD from their internal balance; the stake is
 * escrowed until the creator accepts & delivers (or declines → refund).
 *
 * The POST requires an authenticated session (SIWE cookie). If the viewer isn't
 * signed in the API replies 401 and we nudge them to connect their wallet.
 */
export default function ChallengeButton({ creatorUsername }: { creatorUsername: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stake, setStake] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setStatus(null);
    const stakeNum = Number(stake);
    if (title.trim().length < 3) {
      setError('Escribe un título de al menos 3 caracteres.');
      return;
    }
    if (!Number.isFinite(stakeNum) || stakeNum <= 0) {
      setError('Ingresa un stake válido en AUSD.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_username: creatorUsername,
          title: title.trim(),
          description: description.trim() || undefined,
          stake_ausd: stakeNum,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setError('Inicia sesión con tu wallet para enviar un reto.');
        return;
      }
      if (res.status === 402) {
        setError('Saldo AUSD insuficiente. Recarga desde tu wallet.');
        return;
      }
      if (!res.ok) {
        setError(data.error ?? 'No se pudo enviar el reto.');
        return;
      }
      setStatus('¡Reto enviado! Tu stake quedó en garantía hasta que el creador responda.');
      setTitle('');
      setDescription('');
      setStake('');
      setOpen(false);
    } catch {
      setError('No se pudo enviar el reto.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-4">
        <button className="btn-ghost" onClick={() => setOpen(true)}>
          Enviar un reto
        </button>
        {status && <p className="mt-2 text-xs text-brand" role="status">{status}</p>}
      </div>
    );
  }

  return (
    <div className="card mt-4 p-5">
      <p className="font-semibold">Enviar un reto a @{creatorUsername}</p>
      <p className="mt-1 text-xs text-ink/60">
        Financias el reto con AUSD de tu saldo. Se libera al creador solo si acepta y entrega; si lo rechaza, se te reembolsa.
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <label className="label" htmlFor="ch-title">Título</label>
          <input id="ch-title" className="input" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} placeholder="Ej. Dibuja mi personaje" />
        </div>
        <div>
          <label className="label" htmlFor="ch-desc">Detalle (opcional)</label>
          <textarea id="ch-desc" className="input min-h-[80px]" maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} />
        </div>
        <div>
          <label className="label" htmlFor="ch-stake">Stake (AUSD)</label>
          <input id="ch-stake" className="input w-40" inputMode="decimal" value={stake} onChange={(e) => setStake(e.target.value)} disabled={busy} placeholder="0.00" />
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Enviando…' : 'Enviar reto'}
          </button>
          <button className="btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancelar
          </button>
        </div>
        {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
      </div>
    </div>
  );
}
