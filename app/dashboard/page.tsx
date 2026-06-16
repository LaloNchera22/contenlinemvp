'use client';

import { useEffect, useState } from 'react';

interface Metrics {
  grossRevenue: number;
  totalFees: number;
  netRevenue: number;
  transactionCount: number;
  activeSubscribers: number;
  byCategory: Record<string, number>;
}

export default function DashboardHome() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/metrics')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setMetrics)
      .catch(() => setError('Inicia sesión para ver tus métricas.'));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">Resumen del mes</h1>
      <p className="text-white/50 text-sm mt-1">Métricas de tu actividad en Contenline.</p>

      {error && <p className="mt-6 text-sm text-amber-400">{error}</p>}

      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Ingreso bruto" value={metrics ? usd(metrics.grossRevenue) : '—'} />
        <Stat label="Ingreso neto" value={metrics ? usd(metrics.netRevenue) : '—'} highlight />
        <Stat label="Comisiones" value={metrics ? usd(metrics.totalFees) : '—'} />
        <Stat label="Suscriptores activos" value={metrics ? String(metrics.activeSubscribers) : '—'} />
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="card">
      <p className="label">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-brand-light' : ''}`}>{value}</p>
    </div>
  );
}

function usd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
