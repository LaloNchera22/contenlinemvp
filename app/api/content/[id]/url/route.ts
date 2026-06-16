import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const SIGNED_URL_TTL = 60 * 15; // 15 minutos
const PRIVATE_BUCKET = 'exclusive-content';

/**
 * GET /api/content/[id]/url
 * Genera una signed URL temporal SOLO si RLS confirma que el usuario tiene acceso.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  // 1. Leer con el JWT del usuario: RLS (exclusive_content_access) decide visibilidad.
  const supabase = createServerClient(session.token);
  const { data: content, error } = await supabase
    .from('content')
    .select('id, media_url, is_exclusive')
    .eq('id', params.id)
    .maybeSingle();

  // Si RLS lo oculta, content será null → acceso denegado.
  if (error || !content) {
    return NextResponse.json({ error: 'Sin acceso a este contenido' }, { status: 403 });
  }

  if (!content.media_url) {
    return NextResponse.json({ error: 'El contenido no tiene media' }, { status: 404 });
  }

  // Contenido público: la URL directa basta.
  if (!content.is_exclusive) {
    return NextResponse.json({ url: content.media_url, exclusive: false });
  }

  // 2. media_url para exclusivo guarda la ruta dentro del bucket privado.
  const objectPath = content.media_url.replace(/^.*exclusive-content\//, '');

  // 3. Generar signed URL con service_role (acceso al bucket privado).
  const admin = createAdminClient();
  const { data: signed, error: signErr } = await admin.storage
    .from(PRIVATE_BUCKET)
    .createSignedUrl(objectPath, SIGNED_URL_TTL);

  if (signErr || !signed) {
    return NextResponse.json({ error: 'No se pudo generar la URL' }, { status: 500 });
  }

  return NextResponse.json({
    url: signed.signedUrl,
    exclusive: true,
    expiresInSeconds: SIGNED_URL_TTL,
  });
}
