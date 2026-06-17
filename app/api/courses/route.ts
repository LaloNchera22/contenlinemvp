import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import { LIMITS, requireString, optionalString, validatePrice, isValidationError } from '@/lib/validation';

export const runtime = 'nodejs';

/** GET /api/courses — cursos del creador (incluye no publicados). */
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const supabase = createServerClient(session.token);
  const { data, error } = await supabase
    .from('courses')
    .select('id, title, description, price_usdc, cover_url, published, created_at')
    .eq('creator_id', session.sub)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Error al consultar' }, { status: 500 });
  return NextResponse.json({ courses: data ?? [] });
}

/** POST /api/courses — crea un curso (no publicado por defecto). */
export async function POST(req: NextRequest) {
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
    .insert({
      creator_id: session.sub,
      title,
      description,
      price_usdc: price,
      published: false,
    })
    .select('id, title, description, price_usdc, cover_url, published, created_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'No se pudo crear el curso' }, { status: 500 });
  }
  return NextResponse.json({ course: data }, { status: 201 });
}
