import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const CATEGORIES = ['subscription', 'onchain', 'course', 'service'];

/**
 * GET /api/transactions/export[?category=]
 * Exporta las transacciones del creador como CSV para reconciliación contable
 * (declaración fiscal de cripto). Solo las propias (RLS + filtro por creator).
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const category = new URL(req.url).searchParams.get('category');

  const supabase = createServerClient(session.token);
  let query = supabase
    .from('transactions')
    .select('created_at, category, from_wallet, amount_usdc, fee_percent, fee_usdc, net_usdc, tx_hash, verified')
    .eq('creator_id', session.sub)
    .order('created_at', { ascending: false });

  if (category && CATEGORIES.includes(category)) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Error al consultar' }, { status: 500 });

  const header = [
    'fecha', 'categoria', 'de_wallet', 'monto_usdc', 'fee_pct', 'fee_usdc', 'neto_usdc', 'tx_hash', 'verificada',
  ];
  const rows = (data ?? []).map((t) =>
    [
      t.created_at,
      t.category,
      t.from_wallet,
      t.amount_usdc,
      t.fee_percent,
      t.fee_usdc,
      t.net_usdc,
      t.tx_hash ?? '',
      t.verified ? 'si' : 'no',
    ]
      .map(csvCell)
      .join(','),
  );
  const csv = [header.join(','), ...rows].join('\r\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="contenline-transacciones-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

/** Escapa una celda CSV (comillas, comas, saltos de línea). */
function csvCell(value: unknown): string {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
