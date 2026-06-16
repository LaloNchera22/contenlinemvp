import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getSessionFromRequest } from '@/lib/auth';
import { createServerClient, SESSION_COOKIE } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/** GET /api/me — perfil del usuario autenticado. */
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
  return NextResponse.json({ user: data });
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

  const res = NextResponse.json({ ok: true, anonymized: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
