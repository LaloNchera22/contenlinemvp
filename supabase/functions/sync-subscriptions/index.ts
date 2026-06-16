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
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const client = createPublicClient({
    chain: polygon,
    transport: http(Deno.env.get('POLYGON_RPC_URL')),
  });
  const contract = Deno.env.get('CONTRACT_SUBSCRIPTION') as `0x${string}`;

  // Suscripciones que la DB cree activas pero ya vencidas, o por revalidar.
  const { data: subs } = await admin
    .from('subscriptions')
    .select('id, subscriber_wallet, creator_id, expires_at, active')
    .eq('active', true);

  // Resolver wallet del creador.
  const creatorIds = [...new Set((subs ?? []).map((s) => s.creator_id))];
  const { data: creators } = await admin
    .from('users')
    .select('id, wallet')
    .in('id', creatorIds.length ? creatorIds : ['00000000-0000-0000-0000-000000000000']);
  const walletById = new Map((creators ?? []).map((c) => [c.id, c.wallet]));

  let updated = 0;
  for (const s of subs ?? []) {
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

  return new Response(JSON.stringify({ synced: subs?.length ?? 0, updated }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
