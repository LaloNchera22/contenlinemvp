import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import { isSafeHttpsUrl } from '@/lib/url';
import { LIMITS, requireString, optionalString, isValidationError } from '@/lib/validation';

export const runtime = 'nodejs';

const MEDIA_TYPES = ['image', 'video', 'document'];

// Ruta de objeto dentro de un bucket privado (no es una URL con protocolo).
// Aceptamos solo caracteres seguros para descartar `javascript:`, `data:`, etc.
const STORAGE_PATH = /^[a-zA-Z0-9/_.\-]{1,300}$/;

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

  // Validación de longitud (defensa en profundidad: el CHECK de Postgres también
  // la aplica, pero devolvemos 400 con mensaje claro en vez de un 500 opaco).
  const title = requireString(body.title, 'title', 1, LIMITS.content_title);
  if (isValidationError(title)) return NextResponse.json(title, { status: 400 });

  const bodyText = optionalString(body.body, 'body', LIMITS.content_body);
  if (isValidationError(bodyText)) return NextResponse.json(bodyText, { status: 400 });

  if (body.media_type && !MEDIA_TYPES.includes(body.media_type)) {
    return NextResponse.json({ error: 'media_type inválido' }, { status: 400 });
  }

  // media_url se renderiza luego (img/video/href). Sin validar protocolo, un
  // `javascript:` o `data:text/html` guardado aquí sería un vector XSS. El
  // contenido exclusivo guarda una RUTA de storage (servida vía signed URL); el
  // público guarda una URL https.
  const isExclusive = body.is_exclusive ?? true;
  if (body.media_url) {
    const okPath = isExclusive && STORAGE_PATH.test(body.media_url);
    const okUrl = !isExclusive && isSafeHttpsUrl(body.media_url);
    if (!okPath && !okUrl) {
      return NextResponse.json(
        { error: isExclusive ? 'media_url debe ser una ruta de storage válida' : 'media_url debe ser https' },
        { status: 400 },
      );
    }
  }

  const supabase = createServerClient(session.token);
  const { data, error } = await supabase
    .from('content')
    .insert({
      creator_id: session.sub,
      title,
      body: bodyText,
      media_url: body.media_url ?? null,
      media_type: body.media_type ?? null,
      is_exclusive: isExclusive,
    })
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'No se pudo crear el contenido' }, { status: 500 });
  }
  return NextResponse.json({ content: data }, { status: 201 });
}
