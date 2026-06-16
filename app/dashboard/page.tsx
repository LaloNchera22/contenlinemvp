'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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

  // Creador nuevo: sin transacciones ni suscriptores → mostrar onboarding.
  const isNewCreator =
    !!metrics &&
    metrics.transactionCount === 0 &&
    metrics.activeSubscribers === 0;

  return (
    <div>
      <h1 className="text-2xl font-bold">Resumen del mes</h1>
      <p className="text-white/60 text-sm mt-1">Métricas de tu actividad en Contenline.</p>

      {error && <p className="mt-6 text-sm text-amber-400" role="alert">{error}</p>}

      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Ingreso bruto" value={metrics ? usd(metrics.grossRevenue) : '—'} />
        <Stat label="Ingreso neto" value={metrics ? usd(metrics.netRevenue) : '—'} highlight />
        <Stat label="Comisiones" value={metrics ? usd(metrics.totalFees) : '—'} />
        <Stat label="Suscriptores activos" value={metrics ? String(metrics.activeSubscribers) : '—'} />
      </div>

      {isNewCreator && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold">Primeros pasos</h2>
          <p className="text-sm text-white/60 mt-1">
            Aún no tienes actividad. Empieza por aquí:
          </p>
          <div className="mt-4 grid sm:grid-cols-3 gap-4">
            <OnboardingCard
              href="/dashboard/content"
              step="1"
              title="Publica contenido"
              body="Sube tu primer contenido exclusivo para suscriptores."
            />
            <OnboardingCard
              href="/dashboard/earnings"
              step="2"
              title="Revisa tus ingresos"
              body="Aquí verás cada pago verificado onchain y podrás exportarlo."
            />
            <OnboardingCard
              href="/dashboard/keys"
              step="3"
              title="Genera una API key"
              body="Integra pagos cripto en tu propia app estilo Stripe."
            />
          </div>
        </div>
      )}
    </div>
  );
}

function OnboardingCard({
  href,
  step,
  title,
  body,
}: {
  href: string;
  step: string;
  title: string;
  body: string;
}) {
  return (
    <Link href={href} className="card hover:border-brand transition-colors block">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
        {step}
      </span>
      <p className="mt-3 font-semibold text-brand-light">{title}</p>
      <p className="mt-1 text-sm text-white/60">{body}</p>
    </Link>
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
