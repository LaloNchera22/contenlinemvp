import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/wallet — internal AUSD balance + recent ledger for the authed user.
 * Reads go through the user's JWT (RLS owner-scoped): a user only ever sees
 * their own wallet and entries.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const supabase = createServerClient(session.token);

  const [{ data: wallet }, { data: ledger }] = await Promise.all([
    supabase.from('wallets').select('balance_ausd, updated_at').eq('user_id', session.sub).maybeSingle(),
    supabase
      .from('ledger_entries')
      .select('id, entry_type, amount_ausd, balance_after, ref_type, ref_id, description, created_at')
      .eq('user_id', session.sub)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  return NextResponse.json({
    balance_ausd: wallet ? Number(wallet.balance_ausd) : 0,
    updated_at: wallet?.updated_at ?? null,
    ledger: ledger ?? [],
  });
}
