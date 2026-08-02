'use client';

import { useEffect, useState } from 'react';

interface Party {
  username: string;
  display_name: string;
}
interface Challenge {
  id: string;
  title: string;
  description: string | null;
  stake_ausd: number;
  fee_percent: number;
  status: string;
  created_at: string;
  from_user: Party | null;
  creator: Party | null;
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-700',
  accepted: 'bg-blue-500/15 text-blue-700',
  fulfilled: 'bg-brand/10 text-brand-dim',
  declined: 'bg-red-500/15 text-red-700',
  cancelled: 'bg-ink/5 text-ink/50',
  expired: 'bg-ink/5 text-ink/50',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptado',
  fulfilled: 'Entregado',
  declined: 'Rechazado',
  cancelled: 'Cancelado',
  expired: 'Expirado',
};

function Badge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? 'bg-ink/5'}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export default function ChallengesPage() {
  const [incoming, setIncoming] = useState<Challenge[]>([]);
  const [outgoing, setOutgoing] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const r = await fetch('/api/challenges');
    if (r.ok) {
      const d = await r.json();
      setIncoming(d.incoming ?? []);
      setOutgoing(d.outgoing ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function act(id: string, action: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/challenges/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'No se pudo procesar la acción.');
    } else {
      await load();
    }
    setBusyId(null);
  }

  if (loading) return <p className="text-sm text-ink/50">Cargando…</p>;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Retos</h1>
      <p className="mt-1 text-sm text-ink/60">
        Los fans te envían retos pagados con AUSD en garantía. Acepta y entrega para cobrar (menos {incoming[0]?.fee_percent ?? 5}% de comisión), o rechaza para reembolsar.
      </p>

      {error && <p className="mt-4 text-sm text-red-600" role="alert">{error}</p>}

      <section className="mt-6">
        <h2 className="font-semibold">Recibidos</h2>
        {incoming.length === 0 ? (
          <p className="mt-3 text-sm text-ink/50">Aún no has recibido retos.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {incoming.map((c) => (
              <li key={c.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{c.title}</h3>
                      <Badge status={c.status} />
                    </div>
                    {c.description && <p className="mt-1 text-sm text-ink/60">{c.description}</p>}
                    <p className="mt-2 text-xs text-ink/50">
                      De <span className="text-ink/70">@{c.from_user?.username ?? '—'}</span> ·{' '}
                      <span className="font-mono text-brand">{c.stake_ausd} AUSD</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    {c.status === 'pending' && (
                      <>
                        <button className="btn-primary" disabled={busyId === c.id} onClick={() => act(c.id, 'accept')}>
                          Aceptar
                        </button>
                        <button className="btn-ghost" disabled={busyId === c.id} onClick={() => act(c.id, 'decline')}>
                          Rechazar
                        </button>
                      </>
                    )}
                    {c.status === 'accepted' && (
                      <>
                        <button className="btn-primary" disabled={busyId === c.id} onClick={() => act(c.id, 'fulfill')}>
                          Marcar entregado
                        </button>
                        <button className="btn-ghost" disabled={busyId === c.id} onClick={() => act(c.id, 'decline')}>
                          Rechazar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">Enviados</h2>
        {outgoing.length === 0 ? (
          <p className="mt-3 text-sm text-ink/50">No has enviado retos.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {outgoing.map((c) => (
              <li key={c.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{c.title}</h3>
                      <Badge status={c.status} />
                    </div>
                    {c.description && <p className="mt-1 text-sm text-ink/60">{c.description}</p>}
                    <p className="mt-2 text-xs text-ink/50">
                      Para <span className="text-ink/70">@{c.creator?.username ?? '—'}</span> ·{' '}
                      <span className="font-mono text-brand">{c.stake_ausd} AUSD</span>
                    </p>
                  </div>
                  {c.status === 'pending' && (
                    <button className="btn-ghost shrink-0" disabled={busyId === c.id} onClick={() => act(c.id, 'cancel')}>
                      Cancelar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
