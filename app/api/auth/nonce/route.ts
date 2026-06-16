import { NextRequest, NextResponse } from 'next/server';
import { isAddress, getAddress } from 'viem';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateNonce, buildSiweMessage, NONCE_TTL_MS } from '@/lib/siwe';

export const runtime = 'nodejs';

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
  const { error } = await admin.from('auth_nonces').insert({
    nonce,
    wallet,
    expires_at: expiresAt.toISOString(),
    used: false,
  });

  if (error) {
    return NextResponse.json({ error: 'No se pudo crear el nonce' }, { status: 500 });
  }

  const message = buildSiweMessage({ nonce, issuedAt, expiresAt });
  return NextResponse.json({ nonce, message, expiresAt: expiresAt.toISOString() });
}
