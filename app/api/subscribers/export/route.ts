import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const STATUSES = ['active', 'expired', 'all'] as const;
type Status = (typeof STATUSES)[number];

/**
 * GET /api/subscribers/export[?status=] — exporta los suscriptores como CSV para
 * outreach / campañas de retención. Mismo patrón que transactions/export: solo
 * los propios (filtro por creator_id + RLS), escapado CSV correcto.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const statusParam = new URL(req.url).searchParams.get('status') ?? 'all';
  const status = (STATUSES.includes(statusParam as Status) ? statusParam : 'all') as Status;
  const nowIso = new Date().toISOString();

  const supabase = createServerClient(session.token);
  let query = supabase
    .from('subscriptions')
    .select('subscriber_wallet, started_at, expires_at, last_tx_hash, active, plan:subscription_plans(name)')
    .eq('creator_id', session.sub)
    .order('expires_at', { ascending: false });

  if (status === 'active') {
    query = query.eq('active', true).gt('expires_at', nowIso);
  } else if (status === 'expired') {
    query = query.lte('expires_at', nowIso);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Error al consultar' }, { status: 500 });

  const header = ['wallet', 'plan', 'suscrito_desde', 'expira', 'ultimo_tx_hash', 'estado'];
  const now = new Date();
  const rows = (data ?? []).map((s) => {
    const plan = Array.isArray(s.plan) ? s.plan[0] : s.plan;
    const vigente = s.active && new Date(s.expires_at) > now;
    return [
      s.subscriber_wallet,
      plan?.name ?? '',
      s.started_at,
      s.expires_at,
      s.last_tx_hash ?? '',
      vigente ? 'activo' : 'expirado',
    ]
      .map(csvCell)
      .join(',');
  });
  const csv = [header.join(','), ...rows].join('\r\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="contenline-suscriptores-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

/** Escapa una celda CSV (comillas, comas, saltos de línea). */
function csvCell(value: unknown): string {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
