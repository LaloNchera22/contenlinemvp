'use client';

import { useEffect, useState } from 'react';
import { FEE_CONFIG } from '@/lib/fees';

interface Tx {
  id: string;
  category: string;
  amount_usdc: number;
  fee_usdc: number;
  net_usdc: number;
  from_wallet: string;
  verified: boolean;
  created_at: string;
}

const CATEGORIES = ['all', 'subscription', 'course', 'service', 'onchain'] as const;

export default function EarningsPage() {
  const [filter, setFilter] = useState<(typeof CATEGORIES)[number]>('all');
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = filter === 'all' ? '' : `?category=${filter}`;
    fetch(`/api/transactions${q}`)
      .then((r) => (r.ok ? r.json() : { transactions: [] }))
      .then((d) => setTxs(d.transactions ?? []))
      .finally(() => setLoading(false));
  }, [filter]);

  const exportHref =
    '/api/transactions/export' + (filter === 'all' ? '' : `?category=${filter}`);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ingresos</h1>
          <p className="text-white/60 text-sm mt-1">
            Modelo de comisiones: suscripción/curso {FEE_CONFIG.subscription * 100}% · servicio/onchain{' '}
            {FEE_CONFIG.service * 100}%.
          </p>
        </div>
        <a href={exportHref} className="btn-ghost text-sm" download>
          Exportar CSV
        </a>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`btn ${filter === c ? 'bg-brand text-white' : 'btn-ghost'}`}
          >
            {c}
          </button>
        ))}
      </div>

      {loading && <p className="mt-6 text-sm text-white/60">Cargando…</p>}
      {!loading && txs.length === 0 && (
        <p className="mt-6 text-sm text-white/60">Sin transacciones todavía.</p>
      )}

      {/* Móvil: cards apilados (cada fila conserva su contexto). */}
      {!loading && txs.length > 0 && (
        <div className="mt-6 space-y-3 sm:hidden">
          {txs.map((t) => (
            <div key={t.id} className="card">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium capitalize">{t.category}</span>
                <span className="text-xs text-white/60">
                  {new Date(t.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-white/60">
                {t.from_wallet.slice(0, 6)}…{t.from_wallet.slice(-4)}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-white/60">Monto</p>
                  <p>${Number(t.amount_usdc).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/60">Comisión</p>
                  <p>${Number(t.fee_usdc).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/60">Neto</p>
                  <p className="text-brand-light">${Number(t.net_usdc).toFixed(2)}</p>
                </div>
              </div>
              <p className="mt-2 text-xs">
                {t.verified ? (
                  <span className="text-green-400">✓ verificada</span>
                ) : (
                  <span className="text-amber-400">pendiente</span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Desktop: tabla. */}
      {!loading && txs.length > 0 && (
        <div className="mt-6 card hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-white/60 text-left">
              <tr>
                <th scope="col" className="py-2">Fecha</th>
                <th scope="col">Categoría</th>
                <th scope="col">De</th>
                <th scope="col" className="text-right">Monto</th>
                <th scope="col" className="text-right">Comisión</th>
                <th scope="col" className="text-right">Neto</th>
                <th scope="col" className="text-right">Estado</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id} className="border-t border-surface-border">
                  <td className="py-2">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="capitalize">{t.category}</td>
                  <td className="font-mono text-xs">
                    {t.from_wallet.slice(0, 6)}…{t.from_wallet.slice(-4)}
                  </td>
                  <td className="text-right">${Number(t.amount_usdc).toFixed(2)}</td>
                  <td className="text-right text-white/60">${Number(t.fee_usdc).toFixed(2)}</td>
                  <td className="text-right text-brand-light">${Number(t.net_usdc).toFixed(2)}</td>
                  <td className="text-right">
                    {t.verified ? (
                      <span className="text-green-400">✓ verificada</span>
                    ) : (
                      <span className="text-amber-400">pendiente</span>
                    )}
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
