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

  return (
    <div>
      <h1 className="text-2xl font-bold">Ingresos</h1>
      <p className="text-white/50 text-sm mt-1">
        Modelo de comisiones: suscripción/curso {FEE_CONFIG.subscription * 100}% · servicio/onchain{' '}
        {FEE_CONFIG.service * 100}%.
      </p>

      <div className="mt-6 flex gap-2">
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

      <div className="mt-6 card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-white/40 text-left">
            <tr>
              <th className="py-2">Fecha</th>
              <th>Categoría</th>
              <th>De</th>
              <th className="text-right">Monto</th>
              <th className="text-right">Comisión</th>
              <th className="text-right">Neto</th>
              <th className="text-right">Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-white/40">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && txs.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-white/40">
                  Sin transacciones todavía.
                </td>
              </tr>
            )}
            {txs.map((t) => (
              <tr key={t.id} className="border-t border-surface-border">
                <td className="py-2">{new Date(t.created_at).toLocaleDateString()}</td>
                <td>{t.category}</td>
                <td className="font-mono text-xs">
                  {t.from_wallet.slice(0, 6)}…{t.from_wallet.slice(-4)}
                </td>
                <td className="text-right">${Number(t.amount_usdc).toFixed(2)}</td>
                <td className="text-right text-white/50">${Number(t.fee_usdc).toFixed(2)}</td>
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
    </div>
  );
}
