import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/**
 * GET /api/email/verify?token=...
 * Consume un token de magic link y marca el email como verificado.
 *
 * Es un enlace que el usuario abre desde su bandeja (GET), así que respondemos con
 * una redirección a /dashboard/settings con un flag, en vez de JSON. No requiere
 * sesión activa en el navegador: el token ES la prueba de posesión del email. El
 * user_id se deriva del token (no del caller), así que no hay riesgo de verificar
 * el email de otra cuenta.
 */
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const settingsUrl = (status: string) =>
    `${appUrl}/dashboard/settings?email=${status}`;

  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return NextResponse.redirect(settingsUrl('invalid'));
  }
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('email_verifications')
    .select('user_id, email, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (!row || new Date(row.expires_at) < new Date()) {
    return NextResponse.redirect(settingsUrl('expired'));
  }

  // Upsert de las preferencias: fija el email verificado conservando los toggles
  // existentes si ya había una fila (el default del JSONB solo aplica al insertar).
  const { error } = await admin
    .from('user_email_prefs')
    .upsert(
      { user_id: row.user_id, email: row.email, email_verified: true, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) {
    return NextResponse.redirect(settingsUrl('error'));
  }

  // Token de un solo uso: consumirlo tras verificar.
  await admin.from('email_verifications').delete().eq('token_hash', tokenHash);

  return NextResponse.redirect(settingsUrl('verified'));
}
