import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, isAddress, getAddress } from 'viem';
import { polygon } from 'viem/chains';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildSiweMessage, NONCE_TTL_MS } from '@/lib/siwe';
import { signSupabaseJwt } from '@/lib/jwt';
import { SESSION_COOKIE } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const publicClient = createPublicClient({
  chain: polygon,
  transport: http(process.env.POLYGON_RPC_URL),
});

/**
 * POST /api/auth/verify
 * body: { wallet, nonce, signature }
 * Verifica la firma SIWE con viem, invalida el nonce y emite un JWT de sesión.
 */
export async function POST(req: NextRequest) {
  let body: { wallet?: string; nonce?: string; signature?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { wallet, nonce, signature } = body;
  if (!wallet || !isAddress(wallet) || !nonce || !signature) {
    return NextResponse.json({ error: 'Parámetros faltantes' }, { status: 400 });
  }
  const address = getAddress(wallet);

  const admin = createAdminClient();

  // 1. Recuperar nonce y validar estado.
  const { data: nonceRow, error: nonceErr } = await admin
    .from('auth_nonces')
    .select('*')
    .eq('nonce', nonce)
    .single();

  if (nonceErr || !nonceRow) {
    return NextResponse.json({ error: 'Nonce no encontrado' }, { status: 401 });
  }
  if (nonceRow.used) {
    return NextResponse.json({ error: 'Nonce ya utilizado' }, { status: 401 });
  }
  if (getAddress(nonceRow.wallet) !== address) {
    return NextResponse.json({ error: 'Nonce no corresponde a la wallet' }, { status: 401 });
  }
  if (new Date(nonceRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Nonce expirado' }, { status: 401 });
  }

  // 2. Reconstruir mensaje y verificar firma onchain-agnostic con viem.
  //    El `issuedAt` debe ser EXACTAMENTE el que se usó al construir el mensaje
  //    en /api/auth/nonce, no `created_at` (DEFAULT now() de la BD, que difiere
  //    en milisegundos). Como expires_at se derivó de issuedAt + NONCE_TTL_MS,
  //    lo reconstruimos restando el TTL para reproducir el mensaje firmado.
  const expiresAt = new Date(nonceRow.expires_at);
  const issuedAt = new Date(expiresAt.getTime() - NONCE_TTL_MS);
  const message = buildSiweMessage({ nonce, issuedAt, expiresAt });

  const valid = await publicClient.verifyMessage({
    address,
    message,
    signature: signature as `0x${string}`,
  });

  if (!valid) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
  }

  // 3. Invalidar nonce de forma atómica (compare-and-swap): solo el request
  //    que logra pasar used=false → used=true continúa. Esto cierra el race
  //    condition de dos requests paralelos con el mismo nonce.
  const { data: consumed } = await admin
    .from('auth_nonces')
    .update({ used: true })
    .eq('nonce', nonce)
    .eq('used', false)
    .select('nonce');

  if (!consumed || consumed.length === 0) {
    return NextResponse.json({ error: 'Nonce ya utilizado' }, { status: 401 });
  }

  // 4. Crear o recuperar usuario.
  let { data: user } = await admin
    .from('users')
    .select('*')
    .eq('wallet', address)
    .maybeSingle();

  if (!user) {
    const shortWallet = address.slice(2, 8).toLowerCase();
    const { data: created, error: createErr } = await admin
      .from('users')
      .insert({
        wallet: address,
        username: `user_${shortWallet}`,
        display_name: `Creator ${shortWallet}`,
      })
      .select('*')
      .single();
    if (createErr || !created) {
      return NextResponse.json({ error: 'No se pudo crear el usuario' }, { status: 500 });
    }
    user = created;
  }

  // 5. Emitir JWT compatible con Supabase (claim `wallet` para RLS).
  const token = signSupabaseJwt({ sub: user.id, wallet: address, role: 'authenticated' });

  const res = NextResponse.json({
    token,
    user: { id: user.id, wallet: address, username: user.username },
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
