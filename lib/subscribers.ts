/**
 * Lógica de negocio de la vista de suscriptores, separada de la UI para poder
 * testearla en aislamiento (las métricas se calculan en el cliente a partir de
 * la lista de activos que devuelve /api/subscribers).
 */

export type Interval = 'monthly' | 'yearly' | null;

export interface SubscriberLike {
  plan_price_usdc: number | null;
  plan_interval: Interval;
  started_at: string;
  expires_at: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Normaliza el precio del plan a ingreso MENSUAL (anual → /12) para el MRR. */
export function monthlyValue(price: number | null, interval: Interval): number {
  if (!price || price <= 0) return 0;
  return interval === 'yearly' ? price / 12 : price;
}

export interface SubscriberMetrics {
  activeCount: number;
  mrr: number;
  expiringSoon: number;
  renewalRate: number; // porcentaje 0–100 (estimado)
}

/**
 * Resume las métricas a partir de la lista de suscriptores ACTIVOS.
 *
 * - mrr: suma de valores mensuales normalizados.
 * - expiringSoon: activos que vencen dentro de `days` (default 7).
 * - renewalRate: % de activos cuya antigüedad (now - started_at) supera un periodo
 *   del plan → implica ≥1 renovación, porque started_at no se reescribe al renovar.
 */
export function summarizeSubscribers(
  active: SubscriberLike[],
  now: number = Date.now(),
  expiringWindowDays = 7,
): SubscriberMetrics {
  const activeCount = active.length;
  let mrr = 0;
  let expiringSoon = 0;
  let renewed = 0;

  for (const s of active) {
    mrr += monthlyValue(s.plan_price_usdc, s.plan_interval);
    if (new Date(s.expires_at).getTime() - now <= expiringWindowDays * DAY_MS) {
      expiringSoon++;
    }
    const periodMs = (s.plan_interval === 'yearly' ? 365 : 30) * DAY_MS;
    if (now - new Date(s.started_at).getTime() > periodMs) renewed++;
  }

  return {
    activeCount,
    mrr: Math.round(mrr * 100) / 100,
    expiringSoon,
    renewalRate: activeCount > 0 ? Math.round((renewed / activeCount) * 100) : 0,
  };
}
