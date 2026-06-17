import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyCreator } from '@/lib/email';

export const runtime = 'nodejs';

/** DELETE /api/keys/[id] — revoca (desactiva) una key del usuario. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const supabase = createServerClient(session.token);
  // RLS (owner_api_keys) garantiza que solo afecta keys propias. Devolvemos el
  // nombre para poder notificar qué key se revocó.
  const { data: revoked, error } = await supabase
    .from('api_keys')
    .update({ active: false })
    .eq('id', params.id)
    .eq('user_id', session.sub)
    .select('name')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'No se pudo revocar' }, { status: 500 });

  // Notificar al creador que una key fue revocada (señal de seguridad útil si la
  // revocación no fue intencional). Best-effort, respeta las prefs.
  if (revoked) {
    await notifyCreator(createAdminClient(), session.sub, 'key_revoked', {
      subject: `API key revocada: ${revoked.name}`,
      html: `<p>Tu API key <strong>${revoked.name}</strong> fue revocada y dejó de funcionar de inmediato. Si no fuiste tú, revisa tu cuenta.</p>`,
    });
  }

  return NextResponse.json({ ok: true, revoked: params.id });
}
