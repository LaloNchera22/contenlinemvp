import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import { LIMITS, requireString, optionalString, validatePrice, isValidationError } from '@/lib/validation';

export const runtime = 'nodejs';

/** PUT /api/services/[id] — actualiza datos del servicio. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  let body: { title?: string; description?: string; price_usdc?: number; active?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const title = requireString(body.title, 'title', 3, LIMITS.service_title);
  if (isValidationError(title)) return NextResponse.json(title, { status: 400 });

  const description = optionalString(body.description, 'description', LIMITS.service_description);
  if (isValidationError(description)) return NextResponse.json(description, { status: 400 });

  const price = validatePrice(body.price_usdc);
  if (isValidationError(price)) return NextResponse.json(price, { status: 400 });

  const update: { title: string; description: string | null; price_usdc: number; active?: boolean } = {
    title,
    description,
    price_usdc: price,
  };
  if (typeof body.active === 'boolean') update.active = body.active;

  const supabase = createServerClient(session.token);
  const { data, error } = await supabase
    .from('services')
    .update(update)
    .eq('id', params.id)
    .eq('creator_id', session.sub)
    .select('id, title, description, price_usdc, active')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'No se pudo actualizar el servicio' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });
  return NextResponse.json({ service: data });
}

/** DELETE /api/services/[id] — elimina el servicio. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const supabase = createServerClient(session.token);
  const { error } = await supabase
    .from('services')
    .delete()
    .eq('id', params.id)
    .eq('creator_id', session.sub);

  if (error) return NextResponse.json({ error: 'No se pudo eliminar el servicio' }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: params.id });
}
