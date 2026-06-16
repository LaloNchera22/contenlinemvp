import { NextRequest, NextResponse } from 'next/server';
import { isAddress, getAddress } from 'viem';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateNonce, buildSiweMessage, NONCE_TTL_MS } from '@/lib/siwe';

export const runtime = 'nodejs';

// Máximo de nonces no usados / no vencidos por wallet (anti-spam / enumeración).
const MAX_ACTIVE_NONCES = 5;

/**
 * POST /api/auth/nonce
 * body: { wallet }
 * Genera un nonce de un solo uso (5 min) y devuelve el mensaje SIWE a firmar.
 */
export async function POST(req: NextRequest) {
  let body: { wallet?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!body.wallet || !isAddress(body.wallet)) {
    return NextResponse.json({ error: 'wallet inválida' }, { status: 400 });
  }
  const wallet = getAddress(body.wallet);

  const nonce = generateNonce();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + NONCE_TTL_MS);

  const admin = createAdminClient();

  // Límite de nonces activos por wallet para evitar spam de la tabla auth_nonces
  // y enumeración de wallets (el endpoint no requiere autenticación previa).
  // La función SQL serializa conteo + inserción con un advisory lock por wallet.
  const { data: created, error } = await admin
    .rpc('create_auth_nonce', {
      p_nonce: nonce,
      p_wallet: wallet,
      p_expires_at: expiresAt.toISOString(),
      p_max_active: MAX_ACTIVE_NONCES,
    });

  if (error) {
    // Fallback no atómico si la función aún no está desplegada (no bloqueamos el
    // login por un schema desactualizado), pero seguimos aplicando el tope.
    const { count } = await admin
      .from('auth_nonces')
      .select('nonce', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString());
    if ((count ?? 0) >= MAX_ACTIVE_NONCES) {
      return NextResponse.json({ error: 'Demasiados nonces activos; intenta más tarde' }, { status: 429 });
    }
    const { error: insErr } = await admin.from('auth_nonces').insert({
      nonce,
      wallet,
      expires_at: expiresAt.toISOString(),
      used: false,
    });
    if (insErr) {
      return NextResponse.json({ error: 'No se pudo crear el nonce' }, { status: 500 });
    }
  } else if (created === false) {
    return NextResponse.json({ error: 'Demasiados nonces activos; intenta más tarde' }, { status: 429 });
  }

  const message = buildSiweMessage({ nonce, issuedAt, expiresAt });
  return NextResponse.json({ nonce, message, expiresAt: expiresAt.toISOString() });
}
