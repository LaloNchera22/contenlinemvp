import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseEventLogs } from 'viem';
import { createAdminClient } from '@/lib/supabase/admin';
import { isWhitelistedContract, PAYMENT_EVENT_ABI, SUBSCRIPTION_EVENT_ABI } from '@/lib/contracts';
import { calculateFee, FeeCategory } from '@/lib/fees';
import { getChain, getRpcUrl } from '@/lib/chain';

export const runtime = 'nodejs';

const publicClient = createPublicClient({
  chain: getChain(),
  transport: http(getRpcUrl()),
});

const CATEGORY_BY_INDEX: Record<number, FeeCategory> = {
  0: 'course',
  1: 'service',
  2: 'onchain',
};

// UUID v4 estricto: el sessionId de un PaymentCompleted llega desde el evento
// onchain y luego se consulta en DB.
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Máximo monto crudo por transacción (100k USDC en micro-USDC). Number(bigint)
// pierde precisión por encima de 2^53; acotamos antes de convertir.
const MAX_AMOUNT_RAW = 100_000n * 1_000_000n;

/**
 * POST /api/transactions/confirm
 * body: { txHash }
 *
 * Verifica el txHash contra el RPC antes de registrar en DB. El crédito al
 * creador y el monto se DERIVAN del evento onchain + la fuente de verdad en DB
 * (payment_sessions / subscription_plans), nunca del caller. Por eso el endpoint
 * no exige autenticación: tanto el creador (dashboard) como un fan que paga un
 * checkout o una suscripción pueden confirmar su propia tx sin poder falsificar
 * a quién se acredita. Toda la validación es onchain + DB e idempotente por
 * txHash.
 */
export async function POST(req: NextRequest) {
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

  // 3. Decodificar evento esperado. Solo logs EMITIDOS por el contrato
  //    whitelisteado (receipt.to); sin este filtro un contrato malicioso en la
  //    misma tx podría inyectar un evento falso y acreditarse un pago.
  const contractLogs = receipt.logs.filter(
    (log) => log.address.toLowerCase() === receipt.to!.toLowerCase(),
  );
  const paymentLogs = parseEventLogs({ abi: PAYMENT_EVENT_ABI, logs: contractLogs });
  const subLogs = parseEventLogs({ abi: SUBSCRIPTION_EVENT_ABI, logs: contractLogs });

  let category: FeeCategory;
  let amountRaw: bigint;
  let feeRaw: bigint;
  let fromWallet: string;
  let creatorId: string;
  let description: string | null = null;
  let apiKeyId: string | null = null;
  // Datos diferidos para el upsert de suscripción (tras validar montos).
  let subContext: { planUuid: string; subscriber: string; expiresAt: bigint } | null = null;

  if (paymentLogs.length > 0) {
    const ev = paymentLogs[0].args as {
      from: string; to: string; sessionId: string; amount: bigint; fee: bigint; category: number;
    };

    if (!UUID_V4.test(ev.sessionId)) {
      return NextResponse.json({ error: 'sessionId inválido' }, { status: 400 });
    }

    // La payment session es la fuente de verdad: monto esperado, creador y la
    // API key que originó el cobro (para atribuir volumen por key).
    const { data: paymentSession } = await admin
      .from('payment_sessions')
      .select('id, amount_usdc, creator_id, api_key_id')
      .eq('id', ev.sessionId)
      .maybeSingle();
    if (!paymentSession) {
      return NextResponse.json({ error: 'Sesión de pago no encontrada' }, { status: 400 });
    }
    const expectedRaw = BigInt(Math.round(Number(paymentSession.amount_usdc) * 1e6));
    if (ev.amount !== expectedRaw) {
      return NextResponse.json(
        { error: 'El monto onchain no coincide con la sesión de pago' },
        { status: 400 },
      );
    }

    category = CATEGORY_BY_INDEX[Number(ev.category)] ?? 'onchain';
    amountRaw = ev.amount;
    feeRaw = ev.fee;
    fromWallet = ev.from;
    creatorId = paymentSession.creator_id;
    apiKeyId = paymentSession.api_key_id ?? null;
    description = `session:${ev.sessionId}`;
  } else if (subLogs.length > 0) {
    const ev = subLogs[0].args as {
      subscriber: string; creator: string; planId: bigint; amount: bigint; fee: bigint; expiresAt: bigint;
    };

    // El creador se DERIVA del destinatario onchain (ev.creator).
    const { data: creator } = await admin
      .from('users')
      .select('id')
      .ilike('wallet', ev.creator)
      .maybeSingle();
    if (!creator) {
      return NextResponse.json({ error: 'Creador onchain desconocido' }, { status: 400 });
    }

    // El planId onchain (uint256) mapea a subscription_plans.onchain_plan_id.
    // Sin esta validación el contrato podría llamarse con un planId arbitrario
    // (válido onchain, inexistente en DB) y registraríamos la tx sin contexto.
    const onchainPlanId = ev.planId.toString();
    const { data: plan } = await admin
      .from('subscription_plans')
      .select('id, price_usdc')
      .eq('creator_id', creator.id)
      .eq('onchain_plan_id', onchainPlanId)
      .maybeSingle();
    if (!plan) {
      return NextResponse.json({ error: 'Plan de suscripción no encontrado' }, { status: 400 });
    }
    const expectedRaw = BigInt(Math.round(Number(plan.price_usdc) * 1e6));
    if (ev.amount !== expectedRaw) {
      return NextResponse.json(
        { error: 'El monto onchain no coincide con el precio del plan' },
        { status: 400 },
      );
    }

    category = 'subscription';
    amountRaw = ev.amount;
    feeRaw = ev.fee;
    fromWallet = ev.subscriber;
    creatorId = creator.id;
    description = `plan:${plan.id}`;
    subContext = { planUuid: plan.id, subscriber: ev.subscriber, expiresAt: ev.expiresAt };
  } else {
    return NextResponse.json({ error: 'No se encontró evento esperado' }, { status: 400 });
  }

  // Acotar el monto crudo antes de convertir: Number(bigint) pierde precisión
  // por encima de 2^53 y corrompería silenciosamente los registros financieros.
  if (amountRaw > MAX_AMOUNT_RAW || feeRaw > MAX_AMOUNT_RAW) {
    return NextResponse.json({ error: 'Monto fuera de rango' }, { status: 400 });
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
      creator_id: creatorId,
      category,
      amount_usdc: amount,
      fee_percent: feePercent * 100,
      fee_usdc: feeAmount,
      net_usdc: netAmount,
      from_wallet: fromWallet,
      tx_hash: txHash,
      description,
      api_key_id: apiKeyId,
      verified: true,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: 'No se pudo registrar la transacción' }, { status: 500 });
  }

  // 5a. Pago vía checkout: marcar la payment session como completada.
  if (apiKeyId !== null || (description?.startsWith('session:') ?? false)) {
    const sessionId = description?.startsWith('session:') ? description.slice('session:'.length) : null;
    if (sessionId) {
      await admin
        .from('payment_sessions')
        .update({ status: 'completed', tx_hash: txHash })
        .eq('id', sessionId);
    }
  }

  // 5b. Suscripción: espejar el estado onchain en la tabla subscriptions.
  if (subContext) {
    const expiresIso = new Date(Number(subContext.expiresAt) * 1000).toISOString();
    const { data: existingSub } = await admin
      .from('subscriptions')
      .select('id')
      .eq('creator_id', creatorId)
      .ilike('subscriber_wallet', subContext.subscriber)
      .maybeSingle();
    if (existingSub) {
      await admin
        .from('subscriptions')
        .update({
          plan_id: subContext.planUuid,
          active: true,
          expires_at: expiresIso,
          last_tx_hash: txHash,
        })
        .eq('id', existingSub.id);
    } else {
      await admin.from('subscriptions').insert({
        creator_id: creatorId,
        subscriber_wallet: subContext.subscriber,
        plan_id: subContext.planUuid,
        active: true,
        expires_at: expiresIso,
        last_tx_hash: txHash,
      });
    }
  }

  return NextResponse.json({ transaction: inserted, verified: true });
}
