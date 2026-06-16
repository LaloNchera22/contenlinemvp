import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const CATEGORIES = ['subscription', 'onchain', 'course', 'service'];

/** GET /api/transactions — lista paginada con filtro por categoría. */
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? '20')));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = createServerClient(session.token);
  let query = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('creator_id', session.sub)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (category && CATEGORIES.includes(category)) {
    query = query.eq('category', category);
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: 'Error al consultar' }, { status: 500 });

  return NextResponse.json({
    transactions: data ?? [],
    page,
    pageSize,
    total: count ?? 0,
  });
}
