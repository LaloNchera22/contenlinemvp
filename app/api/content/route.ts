import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const MEDIA_TYPES = ['image', 'video', 'document'];

/** POST /api/content — crea nuevo contenido del creador. */
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  let body: {
    title?: string;
    body?: string;
    media_url?: string;
    media_type?: string;
    is_exclusive?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'title requerido' }, { status: 400 });
  }
  if (body.media_type && !MEDIA_TYPES.includes(body.media_type)) {
    return NextResponse.json({ error: 'media_type inválido' }, { status: 400 });
  }

  const supabase = createServerClient(session.token);
  const { data, error } = await supabase
    .from('content')
    .insert({
      creator_id: session.sub,
      title: body.title.trim(),
      body: body.body ?? null,
      media_url: body.media_url ?? null,
      media_type: body.media_type ?? null,
      is_exclusive: body.is_exclusive ?? true,
    })
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'No se pudo crear el contenido' }, { status: 500 });
  }
  return NextResponse.json({ content: data }, { status: 201 });
}
