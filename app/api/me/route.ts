import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getSessionFromRequest } from '@/lib/auth';
import { createServerClient, SESSION_COOKIE } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// Tipos de notificación válidos (espejo del default JSONB en schema.sql).
const NOTIFICATION_KEYS = ['new_subscriber', 'new_purchase', 'key_revoked'] as const;

/** GET /api/me — perfil del usuario autenticado + preferencias de email. */
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const supabase = createServerClient(session.token);
  const { data, error } = await supabase
    .from('users')
    .select('id, wallet, username, display_name, bio, avatar_url, created_at')
    .eq('id', session.sub)
    .single();

  if (error || !data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  // Preferencias de email (tabla aparte, RLS owner-only). Puede no existir aún.
  const { data: prefs } = await supabase
    .from('user_email_prefs')
    .select('email, email_verified, email_notifications')
    .eq('user_id', session.sub)
    .maybeSingle();

  return NextResponse.json({
    user: data,
    email: prefs?.email ?? null,
    email_verified: prefs?.email_verified ?? false,
    email_notifications: prefs?.email_notifications ?? {
      new_subscriber: true,
      new_purchase: true,
      key_revoked: true,
    },
  });
}

/**
 * PUT /api/me — actualiza las preferencias de notificación por email.
 * body: { email_notifications: { new_subscriber, new_purchase, key_revoked } }
 *
 * NO cambia el email (eso requiere el flujo de verificación). Solo togglea qué
 * eventos se notifican sobre un email ya verificado.
 */
export async function PUT(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  let body: { email_notifications?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const input = body.email_notifications;
  if (typeof input !== 'object' || input === null) {
    return NextResponse.json({ error: 'email_notifications requerido' }, { status: 400 });
  }
  // Sanitizar: solo claves conocidas y valores booleanos (evita inyectar claves
  // arbitrarias en el JSONB).
  const sanitized: Record<string, boolean> = {};
  for (const key of NOTIFICATION_KEYS) {
    sanitized[key] = input[key] === true;
  }

  const supabase = createServerClient(session.token);
  // Solo actualizamos la fila existente (creada al verificar el email). Si no hay
  // email verificado, no hay preferencias que togglear.
  const { data, error } = await supabase
    .from('user_email_prefs')
    .update({ email_notifications: sanitized, updated_at: new Date().toISOString() })
    .eq('user_id', session.sub)
    .select('email_notifications')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'No se pudo actualizar' }, { status: 500 });
  if (!data) {
    return NextResponse.json(
      { error: 'Verifica un email antes de configurar notificaciones' },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, email_notifications: data.email_notifications });
}

/**
 * DELETE /api/me — derecho al olvido (RGPD art. 17).
 *
 * Anonimiza los datos personales del perfil (display_name, bio, avatar) y libera
 * el username. NO borramos la fila ni la wallet: las transacciones onchain son
 * inmutables y deben conservarse por obligaciones contables/fiscales; la wallet
 * es un identificador pseudónimo ya público en la blockchain. Las API keys del
 * usuario se desactivan. La sesión se cierra.
 */
export async function DELETE(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const admin = createAdminClient();
  const anonSuffix = randomBytes(5).toString('hex');

  const { error } = await admin
    .from('users')
    .update({
      username: `deleted_${anonSuffix}`,
      display_name: 'Cuenta eliminada',
      bio: null,
      avatar_url: null,
      is_adult: false,
    })
    .eq('id', session.sub);

  if (error) {
    return NextResponse.json({ error: 'No se pudo procesar el borrado' }, { status: 500 });
  }

  // Desactivar API keys del usuario (dejan de funcionar inmediatamente).
  await admin.from('api_keys').update({ active: false }).eq('user_id', session.sub);

  // Borrar el email (PII) y sus preferencias: el derecho al olvido alcanza al
  // email almacenado para notificaciones.
  await admin.from('user_email_prefs').delete().eq('user_id', session.sub);
  await admin.from('email_verifications').delete().eq('user_id', session.sub);

  const res = NextResponse.json({ ok: true, anonymized: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
