'use client';

import { useEffect, useState } from 'react';
import EmptyState from '@/app/components/EmptyState';
import SkeletonRow from '@/app/components/SkeletonRow';
import { summarizeSubscribers } from '@/lib/subscribers';

interface Subscriber {
  id: string;
  wallet: string;
  plan_name: string | null;
  plan_price_usdc: number | null;
  plan_interval: 'monthly' | 'yearly' | null;
  started_at: string;
  expires_at: string;
  last_tx_hash: string | null;
  active: boolean;
}

const TABS = [
  { key: 'active', label: 'Activos' },
  { key: 'expired', label: 'Expirados' },
  { key: 'all', label: 'Todos' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const DAY_MS = 24 * 60 * 60 * 1000;

/** "en 12 días" / "hace 3 días" relativo a hoy. */
function relativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.round(diff / DAY_MS);
  if (days === 0) return 'hoy';
  if (days > 0) return `en ${days} día${days === 1 ? '' : 's'}`;
  const abs = Math.abs(days);
  return `hace ${abs} día${abs === 1 ? '' : 's'}`;
}

function truncWallet(w: string): string {
  return w.length > 12 ? `${w.slice(0, 6)}…${w.slice(-4)}` : w;
}

export default function SubscribersPage() {
  const [tab, setTab] = useState<TabKey>('active');
  const [rows, setRows] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  // Métricas: se calculan sobre la lista de ACTIVOS (independiente del tab).
  const [activeSubs, setActiveSubs] = useState<Subscriber[] | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/subscribers?status=${tab}&limit=200`)
      .then((r) => (r.ok ? r.json() : { subscribers: [] }))
      .then((d) => setRows(d.subscribers ?? []))
      .finally(() => setLoading(false));
  }, [tab]);

  // Una sola carga de activos para las tarjetas de métricas (MRR, expiraciones…).
  useEffect(() => {
    fetch('/api/subscribers?status=active&limit=200')
      .then((r) => (r.ok ? r.json() : { subscribers: [] }))
      .then((d) => setActiveSubs(d.subscribers ?? []));
  }, []);

  const { activeCount, mrr, expiringSoon, renewalRate } = summarizeSubscribers(activeSubs ?? []);

  const exportHref = `/api/subscribers/export?status=${tab}`;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Suscriptores</h1>
          <p className="text-white/60 text-sm mt-1">
            Quién te apoya, qué plan tiene y cuándo expira. Ideal para retención.
          </p>
        </div>
        <a href={exportHref} className="btn-ghost text-sm" download>
          Exportar CSV
        </a>
      </div>

      {/* Tarjetas de métricas. */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Suscriptores activos" value={activeSubs ? String(activeCount) : '—'} />
        <Metric label="MRR estimado" value={activeSubs ? `$${mrr.toFixed(2)}` : '—'} hint="USDC/mes" />
        <Metric label="Expiran en 7 días" value={activeSubs ? String(expiringSoon) : '—'} />
        <Metric label="Tasa de renovación" value={activeSubs ? `${renewalRate}%` : '—'} hint="estimada" />
      </div>

      {/* Tabs. */}
      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`btn ${tab === t.key ? 'bg-brand text-white' : 'btn-ghost'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="mt-6 space-y-3">
          <SkeletonRow cols={5} />
          <SkeletonRow cols={5} />
          <SkeletonRow cols={5} />
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon="👥"
            title="Aún no tienes suscriptores"
            description="Comparte tu link público para empezar."
          />
        </div>
      )}

      {/* Móvil: cards apilados. */}
      {!loading && rows.length > 0 && (
        <div className="mt-6 space-y-3 sm:hidden">
          {rows.map((s) => (
            <div key={s.id} className="card">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs" title={s.wallet}>
                  {truncWallet(s.wallet)}
                </span>
                <StatusBadge active={s.active} />
              </div>
              <p className="mt-2 text-sm">{s.plan_name ?? '—'}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-white/60">
                <div>
                  <p className="text-white/40">Suscrito</p>
                  <p>{new Date(s.started_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-white/40">Expira</p>
                  <p title={new Date(s.expires_at).toLocaleString()}>{relativeTime(s.expires_at)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Desktop: tabla. */}
      {!loading && rows.length > 0 && (
        <div className="mt-6 card hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-white/60 text-left">
              <tr>
                <th scope="col" className="py-2">Wallet</th>
                <th scope="col">Plan</th>
                <th scope="col">Suscrito desde</th>
                <th scope="col">Expira</th>
                <th scope="col" className="text-right">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-surface-border">
                  <td className="py-2 font-mono text-xs" title={s.wallet}>
                    {truncWallet(s.wallet)}
                  </td>
                  <td>{s.plan_name ?? '—'}</td>
                  <td>{new Date(s.started_at).toLocaleDateString()}</td>
                  <td title={new Date(s.expires_at).toLocaleString()}>{relativeTime(s.expires_at)}</td>
                  <td className="text-right">
                    <StatusBadge active={s.active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <p className="text-xs text-white/60">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="text-xs text-white/40">{hint}</p>}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="text-green-400 text-xs">● activo</span>
  ) : (
    <span className="text-white/40 text-xs">○ expirado</span>
  );
}
