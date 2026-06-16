// Edge Function: confirm-transaction
// Verifica un txHash contra el RPC de Polygon antes de registrarlo en DB.
// Deploy: supabase functions deploy confirm-transaction

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createPublicClient, http, parseEventLogs } from 'https://esm.sh/viem@2';
import { polygon } from 'https://esm.sh/viem@2/chains';

const WHITELIST = [
  Deno.env.get('CONTRACT_SUBSCRIPTION')?.toLowerCase(),
  Deno.env.get('CONTRACT_PAYMENT')?.toLowerCase(),
].filter(Boolean);

const PAYMENT_ABI = [
  {
    type: 'event',
    name: 'PaymentCompleted',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'sessionId', type: 'string', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'fee', type: 'uint256', indexed: false },
      { name: 'category', type: 'uint8', indexed: false },
    ],
  },
] as const;

Deno.serve(async (req: Request) => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const client = createPublicClient({
    chain: polygon,
    transport: http(Deno.env.get('POLYGON_RPC_URL')),
  });

  // Fallar ruidosamente si la whitelist está vacía: significa que el entorno no
  // está configurado (faltan CONTRACT_SUBSCRIPTION/CONTRACT_PAYMENT). Sin este
  // guard, WHITELIST.includes() siempre daría false y devolveríamos un engañoso
  // "Contrato no autorizado" (400) que ocultaría un deploy mal configurado.
  if (WHITELIST.length === 0) {
    return json(
      { error: 'Whitelist de contratos vacía: configura CONTRACT_SUBSCRIPTION y CONTRACT_PAYMENT' },
      500,
    );
  }

  const { txHash } = await req.json().catch(() => ({}));
  if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return json({ error: 'txHash inválido' }, 400);
  }

  // Idempotencia.
  const { data: existing } = await admin
    .from('transactions')
    .select('id')
    .eq('tx_hash', txHash)
    .maybeSingle();
  if (existing) return json({ error: 'Ya procesada' }, 409);

  const receipt = await client.getTransactionReceipt({ hash: txHash }).catch(() => null);
  if (!receipt) return json({ error: 'No encontrada' }, 404);
  if (receipt.status !== 'success') return json({ error: 'Tx fallida' }, 400);
  if (!receipt.to || !WHITELIST.includes(receipt.to.toLowerCase())) {
    return json({ error: 'Contrato no autorizado' }, 400);
  }

  // Solo logs emitidos por el contrato whitelisteado (receipt.to). Sin este
  // filtro un contrato malicioso en la misma tx podría inyectar un evento
  // PaymentCompleted falso (con `to`/`amount` arbitrarios) y acreditar un pago.
  const contractLogs = receipt.logs.filter(
    (log) => log.address.toLowerCase() === receipt.to!.toLowerCase(),
  );
  const logs = parseEventLogs({ abi: PAYMENT_ABI, logs: contractLogs });
  if (logs.length === 0) return json({ error: 'Sin evento esperado' }, 400);

  const ev = logs[0].args as {
    from: string; to: string; sessionId: string; amount: bigint; fee: bigint; category: number;
  };

  // El creador se DERIVA del destinatario onchain (ev.to), nunca del body.
  // Así un developer no puede redirigir el crédito del pago a otro creador.
  const { data: creator } = await admin
    .from('users')
    .select('id')
    .ilike('wallet', ev.to)
    .maybeSingle();
  if (!creator) return json({ error: 'Destinatario onchain no es un creador conocido' }, 400);

  const amount = Number(ev.amount) / 1e6;
  const fee = Number(ev.fee) / 1e6;
  const net = Math.round((amount - fee) * 1e6) / 1e6;
  const categoryMap: Record<number, string> = { 0: 'course', 1: 'service', 2: 'onchain' };

  await admin.from('transactions').insert({
    creator_id: creator.id,
    category: categoryMap[Number(ev.category)] ?? 'onchain',
    amount_usdc: amount,
    fee_percent: amount > 0 ? Math.round((fee / amount) * 10000) / 100 : 0,
    fee_usdc: fee,
    net_usdc: net,
    from_wallet: ev.from,
    tx_hash: txHash,
    description: `session:${ev.sessionId}`,
    verified: true,
  });

  // Marcar la payment session como completada.
  await admin
    .from('payment_sessions')
    .update({ status: 'completed', tx_hash: txHash })
    .eq('id', ev.sessionId);

  return json({ verified: true });
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
