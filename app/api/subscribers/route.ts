import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Estados de filtro. 'active' = vigente; 'expired' = ya venció (win-back);
// 'all' = histórico completo.
const STATUSES = ['active', 'expired', 'all'] as const;
type Status = (typeof STATUSES)[number];

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * GET /api/subscribers — suscriptores del creador autenticado.
 *
 * Devuelve wallet, plan, started_at, expires_at y last_tx_hash. Por defecto solo
 * los vigentes (active=true AND expires_at>now). RLS (creator_view_subscriptions)
 * ya restringe a las filas propias; igualmente filtramos por creator_id para que
 * la intención sea explícita en la query (validación en dos capas).
 *
 * Query params: ?status=active|expired|all  ?limit=50  ?offset=0
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get('status') ?? 'active') as Status;
  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: 'status inválido' }, { status: 400 });
  }
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get('limit') ?? DEFAULT_LIMIT)));
  const offset = Math.max(0, Number(searchParams.get('offset') ?? 0));
  const nowIso = new Date().toISOString();

  const supabase = createServerClient(session.token);
  let query = supabase
    .from('subscriptions')
    // Join con el plan para mostrar su nombre/precio (FK plan_id → subscription_plans.id).
    .select(
      'id, subscriber_wallet, started_at, expires_at, last_tx_hash, active, plan:subscription_plans(name, price_usdc, interval)',
      { count: 'exact' },
    )
    .eq('creator_id', session.sub)
    .order('expires_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status === 'active') {
    query = query.eq('active', true).gt('expires_at', nowIso);
  } else if (status === 'expired') {
    // Vencidos: lo relevante para campañas de retención (su expiry ya pasó).
    query = query.lte('expires_at', nowIso);
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: 'Error al consultar' }, { status: 500 });

  // Normalizar la forma del join (Supabase devuelve plan como objeto o null).
  const subscribers = (data ?? []).map((s) => {
    const plan = Array.isArray(s.plan) ? s.plan[0] : s.plan;
    return {
      id: s.id,
      wallet: s.subscriber_wallet,
      plan_name: plan?.name ?? null,
      plan_price_usdc: plan?.price_usdc ?? null,
      plan_interval: plan?.interval ?? null,
      started_at: s.started_at,
      expires_at: s.expires_at,
      last_tx_hash: s.last_tx_hash,
      active: s.active && new Date(s.expires_at) > new Date(),
    };
  });

  return NextResponse.json({ subscribers, status, limit, offset, total: count ?? 0 });
}
