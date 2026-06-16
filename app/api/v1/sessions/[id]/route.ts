import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/validateApiKey';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/** GET /api/v1/sessions/[id] — estado de una payment session (API pública). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const auth = await validateApiKey(req.headers.get('authorization'), {
    endpoint: '/api/v1/sessions',
    ip,
  });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const { data: session } = await admin
    .from('payment_sessions')
    .select('id, api_key_id, amount_usdc, category, description, status, tx_hash, expires_at, created_at')
    .eq('id', params.id)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 });

  // La key solo puede ver sus propias sesiones.
  if (session.api_key_id !== auth.key.id) {
    return NextResponse.json({ error: 'No autorizado para esta sesión' }, { status: 403 });
  }

  // Marcar expirada si corresponde.
  if (session.status === 'pending' && new Date(session.expires_at) < new Date()) {
    await admin.from('payment_sessions').update({ status: 'expired' }).eq('id', session.id);
    session.status = 'expired';
  }

  return NextResponse.json({ session });
}
