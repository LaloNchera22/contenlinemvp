import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** GET /api/metrics — métricas del mes en curso para el creador. */
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const supabase = createServerClient(session.token);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: txs, error } = await supabase
    .from('transactions')
    .select('category, amount_usdc, fee_usdc, net_usdc, created_at')
    .eq('creator_id', session.sub)
    .gte('created_at', monthStart.toISOString());

  if (error) return NextResponse.json({ error: 'Error al consultar' }, { status: 500 });

  const rows = txs ?? [];
  const grossRevenue = sum(rows.map((t) => Number(t.amount_usdc)));
  const totalFees = sum(rows.map((t) => Number(t.fee_usdc)));
  const netRevenue = sum(rows.map((t) => Number(t.net_usdc)));

  const byCategory: Record<string, number> = {};
  for (const t of rows) {
    byCategory[t.category] = (byCategory[t.category] ?? 0) + Number(t.net_usdc);
  }

  const { count: activeSubscribers } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', session.sub)
    .eq('active', true)
    .gt('expires_at', new Date().toISOString());

  return NextResponse.json({
    period: monthStart.toISOString(),
    grossRevenue,
    totalFees,
    netRevenue,
    transactionCount: rows.length,
    activeSubscribers: activeSubscribers ?? 0,
    byCategory,
  });
}

function sum(arr: number[]): number {
  return Math.round(arr.reduce((a, b) => a + b, 0) * 1e6) / 1e6;
}
