import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkIpRateLimit, clientIp } from '@/lib/rateLimit';
import { validateAmount } from '@/lib/validation';
import { requestWithdrawal } from '@/lib/ledger';
import { canWithdraw, isBlockedAddress, KycStatus } from '@/lib/compliance';

export const runtime = 'nodejs';

/**
 * POST /api/wallet/withdraw
 * body: { toAddress, amount }
 *
 * Cashes an internal AUSD balance back out to on-chain USDC (1:1). This is the
 * AML-sensitive off-ramp, so it is gated by:
 *   1. authentication (only the balance owner can withdraw),
 *   2. sanctions/blocklist screening of the destination address (fail-closed),
 *   3. KYC policy (canWithdraw) above the anonymous threshold.
 * The AUSD debit is atomic (ausd_withdraw, advisory-locked); the USDC payout from
 * the treasury is settled out-of-band by a treasury signer and reconciled via
 * withdrawal_mark_sent().
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const rl = await checkIpRateLimit(clientIp(req), 'withdraw', 10, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiadas solicitudes; intenta más tarde' }, { status: 429 });
  }

  let body: { toAddress?: string; amount?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const toAddress = typeof body.toAddress === 'string' ? body.toAddress.trim() : '';
  if (!/^0x[0-9a-fA-F]{40}$/.test(toAddress)) {
    return NextResponse.json({ error: 'Dirección de destino inválida' }, { status: 400 });
  }

  const amount = validateAmount(body.amount);
  if (typeof amount !== 'number') {
    return NextResponse.json({ error: amount.error }, { status: 400 });
  }

  const admin = createAdminClient();

  // Sanctions screening of the destination address (fail-closed).
  if (await isBlockedAddress(admin, toAddress)) {
    return NextResponse.json({ error: 'Dirección no permitida' }, { status: 403 });
  }

  // KYC / jurisdiction gate.
  const { data: user } = await admin
    .from('users')
    .select('kyc_status, kyc_country')
    .eq('id', session.sub)
    .maybeSingle();
  const gate = canWithdraw((user?.kyc_status as KycStatus) ?? 'unverified', amount, {
    country: user?.kyc_country ?? null,
  });
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason, code: gate.code }, { status: 403 });
  }

  try {
    const { withdrawalId, balance } = await requestWithdrawal(session.sub, toAddress, amount);
    return NextResponse.json({
      ok: true,
      withdrawal_id: withdrawalId,
      status: 'pending',
      balance_ausd: balance,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (/insufficient_balance/.test(msg)) {
      return NextResponse.json({ error: 'Saldo insuficiente' }, { status: 400 });
    }
    return NextResponse.json({ error: 'No se pudo procesar el retiro' }, { status: 500 });
  }
}
