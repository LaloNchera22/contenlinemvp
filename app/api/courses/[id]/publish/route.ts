import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * PUT /api/courses/[id]/publish — alterna el estado de publicación.
 *
 * Se separa del PUT de datos porque publicar/despublicar tiene una semántica
 * distinta (cambia la visibilidad pública vía la policy public_read_published_courses)
 * y conviene poder hacerlo sin reenviar todos los campos del curso.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  let body: { published?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (typeof body.published !== 'boolean') {
    return NextResponse.json({ error: 'published debe ser booleano' }, { status: 400 });
  }

  const supabase = createServerClient(session.token);
  const { data, error } = await supabase
    .from('courses')
    .update({ published: body.published })
    .eq('id', params.id)
    .eq('creator_id', session.sub)
    .select('id, published')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'No se pudo cambiar la publicación' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });
  return NextResponse.json({ course: data });
}
