// Edge Function: verify-siwe
// Alternativa server-side a /api/auth/verify para verificar la firma SIWE
// y emitir un JWT compatible con Supabase. Deploy si prefieres mover la
// verificación fuera de Next.js.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createPublicClient, http, getAddress } from 'https://esm.sh/viem@2';
import { polygon } from 'https://esm.sh/viem@2/chains';
import { create as createJwt } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

function buildMessage(nonce: string, issuedAt: string, expiresAt: string): string {
  return [
    'Contenline quiere que inicies sesión con tu cuenta de Ethereum.',
    `Nonce: ${nonce}`,
    `Emitido en: ${issuedAt}`,
    `Expira en: ${expiresAt}`,
  ].join('\n');
}

Deno.serve(async (req: Request) => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const client = createPublicClient({
    chain: polygon,
    transport: http(Deno.env.get('POLYGON_RPC_URL')),
  });

  const { wallet, nonce, signature } = await req.json().catch(() => ({}));
  if (!wallet || !nonce || !signature) return json({ error: 'Parámetros faltantes' }, 400);
  const address = getAddress(wallet);

  const { data: row } = await admin
    .from('auth_nonces')
    .select('*')
    .eq('nonce', nonce)
    .maybeSingle();

  if (!row || row.used) return json({ error: 'Nonce inválido' }, 401);
  if (getAddress(row.wallet) !== address) return json({ error: 'Wallet no coincide' }, 401);
  if (new Date(row.expires_at) < new Date()) return json({ error: 'Nonce expirado' }, 401);

  const message = buildMessage(nonce, row.created_at, row.expires_at);
  const valid = await client.verifyMessage({ address, message, signature });
  if (!valid) return json({ error: 'Firma inválida' }, 401);

  await admin.from('auth_nonces').update({ used: true }).eq('nonce', nonce);

  let { data: user } = await admin.from('users').select('*').eq('wallet', address).maybeSingle();
  if (!user) {
    const short = address.slice(2, 8).toLowerCase();
    const { data: created } = await admin
      .from('users')
      .insert({ wallet: address, username: `user_${short}`, display_name: `Creator ${short}` })
      .select('*')
      .single();
    user = created;
  }

  const secret = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(Deno.env.get('SUPABASE_JWT_SECRET')!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  const now = Math.floor(Date.now() / 1000);
  const token = await createJwt(
    { alg: 'HS256', typ: 'JWT' },
    { sub: user!.id, wallet: address, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 604800 },
    secret,
  );

  return json({ token, user: { id: user!.id, wallet: address, username: user!.username } });
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
