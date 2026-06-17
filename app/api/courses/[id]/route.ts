import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import { LIMITS, requireString, optionalString, validatePrice, isValidationError } from '@/lib/validation';

export const runtime = 'nodejs';

/** PUT /api/courses/[id] — actualiza datos del curso (no el estado de publicación). */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  let body: { title?: string; description?: string; price_usdc?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const title = requireString(body.title, 'title', 3, LIMITS.course_title);
  if (isValidationError(title)) return NextResponse.json(title, { status: 400 });

  const description = optionalString(body.description, 'description', LIMITS.course_description);
  if (isValidationError(description)) return NextResponse.json(description, { status: 400 });

  const price = validatePrice(body.price_usdc);
  if (isValidationError(price)) return NextResponse.json(price, { status: 400 });

  const supabase = createServerClient(session.token);
  const { data, error } = await supabase
    .from('courses')
    .update({ title, description, price_usdc: price })
    .eq('id', params.id)
    .eq('creator_id', session.sub)
    .select('id, title, description, price_usdc, cover_url, published')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'No se pudo actualizar el curso' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });
  return NextResponse.json({ course: data });
}

/** DELETE /api/courses/[id] — elimina el curso (cascada a módulos/lecciones). */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const supabase = createServerClient(session.token);
  const { error } = await supabase
    .from('courses')
    .delete()
    .eq('id', params.id)
    .eq('creator_id', session.sub);

  if (error) return NextResponse.json({ error: 'No se pudo eliminar el curso' }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: params.id });
}
