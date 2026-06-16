import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** DELETE /api/keys/[id] — revoca (desactiva) una key del usuario. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const supabase = createServerClient(session.token);
  // RLS (owner_api_keys) garantiza que solo afecta keys propias.
  const { error } = await supabase
    .from('api_keys')
    .update({ active: false })
    .eq('id', params.id)
    .eq('user_id', session.sub);

  if (error) return NextResponse.json({ error: 'No se pudo revocar' }, { status: 500 });
  return NextResponse.json({ ok: true, revoked: params.id });
}
