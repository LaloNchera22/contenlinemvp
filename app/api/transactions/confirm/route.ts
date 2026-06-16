import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseEventLogs } from 'viem';
import { polygon } from 'viem/chains';
import { getSessionFromRequest } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { isWhitelistedContract, PAYMENT_EVENT_ABI, SUBSCRIPTION_EVENT_ABI } from '@/lib/contracts';
import { calculateFee, FeeCategory } from '@/lib/fees';

export const runtime = 'nodejs';

const publicClient = createPublicClient({
  chain: polygon,
  transport: http(process.env.POLYGON_RPC_URL),
});

const CATEGORY_BY_INDEX: Record<number, FeeCategory> = {
  0: 'course',
  1: 'service',
  2: 'onchain',
};

/**
 * POST /api/transactions/confirm
 * body: { txHash, category? }
 * Verifica el txHash contra el RPC de Polygon antes de registrar en DB.
 * (En producción esta lógica vive en la Edge Function confirm-transaction;
 *  aquí se replica para el flujo del dashboard.)
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  let body: { txHash?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const txHash = body.txHash as `0x${string}` | undefined;
  if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return NextResponse.json({ error: 'txHash inválido' }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. Idempotencia: txHash único.
  const { data: existing } = await admin
    .from('transactions')
    .select('id')
    .eq('tx_hash', txHash)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'Transacción ya procesada' }, { status: 409 });
  }

  // 2. Recibo onchain.
  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  } catch {
    return NextResponse.json({ error: 'Transacción no encontrada en la red' }, { status: 404 });
  }

  if (receipt.status !== 'success') {
    return NextResponse.json({ error: 'La transacción no fue exitosa' }, { status: 400 });
  }
  if (!receipt.to || !isWhitelistedContract(receipt.to)) {
    return NextResponse.json({ error: 'Contrato no autorizado' }, { status: 400 });
  }

  // 3. Decodificar evento esperado.
  const paymentLogs = parseEventLogs({ abi: PAYMENT_EVENT_ABI, logs: receipt.logs });
  const subLogs = parseEventLogs({ abi: SUBSCRIPTION_EVENT_ABI, logs: receipt.logs });

  let category: FeeCategory;
  let amountRaw: bigint;
  let feeRaw: bigint;
  let fromWallet: string;
  let description: string | null = null;

  if (paymentLogs.length > 0) {
    const ev = paymentLogs[0].args as {
      from: string; to: string; sessionId: string; amount: bigint; fee: bigint; category: number;
    };
    category = CATEGORY_BY_INDEX[Number(ev.category)] ?? 'onchain';
    amountRaw = ev.amount;
    feeRaw = ev.fee;
    fromWallet = ev.from;
    description = `session:${ev.sessionId}`;
  } else if (subLogs.length > 0) {
    const ev = subLogs[0].args as {
      subscriber: string; creator: string; planId: bigint; amount: bigint; fee: bigint; expiresAt: bigint;
    };
    category = 'subscription';
    amountRaw = ev.amount;
    feeRaw = ev.fee;
    fromWallet = ev.subscriber;
    description = `plan:${ev.planId.toString()}`;
  } else {
    return NextResponse.json({ error: 'No se encontró evento esperado' }, { status: 400 });
  }

  // USDC tiene 6 decimales.
  const amount = Number(amountRaw) / 1e6;
  const { feePercent } = calculateFee(amount, category);
  const feeAmount = Number(feeRaw) / 1e6;
  const netAmount = Math.round((amount - feeAmount) * 1e6) / 1e6;

  // 4. Registrar transacción verificada.
  const { data: inserted, error } = await admin
    .from('transactions')
    .insert({
      creator_id: session.sub,
      category,
      amount_usdc: amount,
      fee_percent: feePercent * 100,
      fee_usdc: feeAmount,
      net_usdc: netAmount,
      from_wallet: fromWallet,
      tx_hash: txHash,
      description,
      verified: true,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: 'No se pudo registrar la transacción' }, { status: 500 });
  }

  return NextResponse.json({ transaction: inserted, verified: true });
}
