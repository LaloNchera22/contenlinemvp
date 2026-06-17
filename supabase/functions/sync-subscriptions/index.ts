// Edge Function: sync-subscriptions  (cron horario)
// Sincroniza el estado onchain de las suscripciones → DB.
// El contrato es la fuente de verdad; la DB es el cache rápido.
// Programar: supabase functions deploy sync-subscriptions  + schedule cron '0 * * * *'

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createPublicClient, http } from 'https://esm.sh/viem@2';
import { polygon } from 'https://esm.sh/viem@2/chains';

const SUBSCRIPTION_ABI = [
  {
    type: 'function',
    name: 'isSubscribed',
    stateMutability: 'view',
    inputs: [
      { name: 'subscriber', type: 'address' },
      { name: 'creator', type: 'address' },
    ],
    outputs: [
      { name: 'active', type: 'bool' },
      { name: 'expiry', type: 'uint256' },
    ],
  },
] as const;

Deno.serve(async () => {
  // Leer las env vars DENTRO del handler (no a top-level): así rotar un secret en
  // Supabase aplica sin esperar un cold-start de la Edge Function. Fallamos
  // cerrado si falta config crítica.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const contract = Deno.env.get('CONTRACT_SUBSCRIPTION') as `0x${string}` | undefined;
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Supabase env vars no configuradas' }, 500);
  }
  if (!contract) {
    return json({ error: 'CONTRACT_SUBSCRIPTION no configurado' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const client = createPublicClient({
    chain: polygon,
    transport: http(Deno.env.get('POLYGON_RPC_URL')),
  });

  // Paginar para no cargar todas las suscripciones en memoria de una Edge
  // Function (límite de CPU ~150ms). Priorizamos las que ya vencieron o están
  // a punto de vencer (próximas 2h), que son las que de verdad hay que revalidar.
  const PAGE_SIZE = 100;
  const horizon = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  type Sub = {
    id: string;
    subscriber_wallet: string;
    creator_id: string;
    expires_at: string;
    active: boolean;
  };
  const subs: Sub[] = [];
  for (let page = 0; ; page++) {
    const from = page * PAGE_SIZE;
    const { data: batch } = await admin
      .from('subscriptions')
      .select('id, subscriber_wallet, creator_id, expires_at, active')
      .eq('active', true)
      .lt('expires_at', horizon)
      .order('expires_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (!batch || batch.length === 0) break;
    subs.push(...(batch as Sub[]));
    if (batch.length < PAGE_SIZE) break;
  }

  // Resolver wallet del creador.
  const creatorIds = [...new Set(subs.map((s) => s.creator_id))];
  const { data: creators } = await admin
    .from('users')
    .select('id, wallet')
    .in('id', creatorIds.length ? creatorIds : ['00000000-0000-0000-0000-000000000000']);
  const walletById = new Map((creators ?? []).map((c) => [c.id, c.wallet]));

  let updated = 0;
  for (const s of subs) {
    const creatorWallet = walletById.get(s.creator_id);
    if (!creatorWallet) continue;

    try {
      const [active, expiry] = (await client.readContract({
        address: contract,
        abi: SUBSCRIPTION_ABI,
        functionName: 'isSubscribed',
        args: [s.subscriber_wallet as `0x${string}`, creatorWallet as `0x${string}`],
      })) as [boolean, bigint];

      const expiresAtIso = new Date(Number(expiry) * 1000).toISOString();
      if (s.active !== active || s.expires_at !== expiresAtIso) {
        await admin
          .from('subscriptions')
          .update({ active, expires_at: expiresAtIso })
          .eq('id', s.id);
        updated++;
      }
    } catch (_e) {
      // skip — reintenta en el próximo ciclo
    }
  }

  return json({ synced: subs.length, updated });
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
