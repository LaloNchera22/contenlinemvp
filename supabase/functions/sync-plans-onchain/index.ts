// Edge Function: sync-plans-onchain
// Marca subscription_plans.onchain_synced = true cuando observa el evento PlanSet
// del contrato de suscripciones. Se dispara de dos formas:
//   1) Webhook de Alchemy/QuickNode al emitirse PlanSet (baja latencia), o
//   2) Cron cada 5 min como fallback (barre los últimos N bloques).
// Programar el fallback: supabase functions deploy sync-plans-onchain + cron '*/5 * * * *'
//
// La fila en DB se crea ANTES de la tx onchain (necesitamos el onchain_plan_id para
// llamar setPlan), así que esta función cierra el lazo: confirma que el plan ya vive
// onchain y, de paso, re-sincroniza el precio por si setPlan lo cambió respecto a la DB.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createPublicClient, http, parseAbiItem, parseEventLogs } from 'https://esm.sh/viem@2';
import { polygon, polygonAmoy } from 'https://esm.sh/viem@2/chains';

const PLAN_SET_EVENT = parseAbiItem(
  'event PlanSet(address indexed creator, uint256 indexed planId, uint256 price, uint256 durationDays, bool active)',
);

// Cuántos bloques mirar hacia atrás en el barrido por cron. ~5 min en Polygon
// (bloque ~2s) ≈ 150 bloques; usamos un margen amplio para tolerar reorgs y
// retrasos del scheduler sin perder eventos.
const DEFAULT_LOOKBACK = 600n;

function getChain() {
  // Mismo criterio que lib/chain.ts: la red la decide CHAIN_ID, sin hardcodear mainnet.
  return Deno.env.get('CHAIN_ID') === '137' ? polygon : polygonAmoy;
}

Deno.serve(async (req: Request) => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const client = createPublicClient({
    chain: getChain(),
    transport: http(Deno.env.get('POLYGON_RPC_URL')),
  });
  const contract = Deno.env.get('CONTRACT_SUBSCRIPTION') as `0x${string}` | undefined;
  if (!contract) {
    return json({ error: 'CONTRACT_SUBSCRIPTION no configurado' }, 500);
  }

  // Permite recibir el rango de bloques desde el webhook del proveedor; si no
  // viene nada (cron), barremos los últimos DEFAULT_LOOKBACK bloques.
  const body = await req.json().catch(() => ({} as { fromBlock?: string; toBlock?: string }));
  const latest = await client.getBlockNumber();
  const fromBlock = body.fromBlock ? BigInt(body.fromBlock) : latest - DEFAULT_LOOKBACK;
  const toBlock = body.toBlock ? BigInt(body.toBlock) : latest;

  const logs = await client.getLogs({
    address: contract,
    event: PLAN_SET_EVENT,
    fromBlock: fromBlock < 0n ? 0n : fromBlock,
    toBlock,
  });
  // parseEventLogs valida el shape y descarta logs malformados.
  const events = parseEventLogs({ abi: [PLAN_SET_EVENT], logs });

  // Cachear la resolución wallet → user_id (varios planes pueden ser del mismo creador).
  const userIdByWallet = new Map<string, string>();
  async function resolveCreator(wallet: string): Promise<string | null> {
    const key = wallet.toLowerCase();
    if (userIdByWallet.has(key)) return userIdByWallet.get(key)!;
    const { data } = await admin.from('users').select('id').ilike('wallet', wallet).maybeSingle();
    if (data?.id) userIdByWallet.set(key, data.id);
    return data?.id ?? null;
  }

  let synced = 0;
  for (const ev of events) {
    const args = ev.args as { creator: string; planId: bigint; price: bigint; active: boolean };
    const creatorId = await resolveCreator(args.creator);
    if (!creatorId) continue;

    const { error } = await admin
      .from('subscription_plans')
      .update({
        onchain_synced: true,
        // El precio onchain manda: si setPlan se llamó con otro monto, alineamos la DB.
        price_usdc: Number(args.price) / 1e6,
        active: args.active,
      })
      .eq('creator_id', creatorId)
      .eq('onchain_plan_id', args.planId.toString());
    if (!error) synced++;
  }

  return json({ scanned: events.length, synced, fromBlock: fromBlock.toString(), toBlock: toBlock.toString() });
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
