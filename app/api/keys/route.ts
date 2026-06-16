import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateApiKey, ApiKeyEnvironment } from '@/lib/apiKeys';

export const runtime = 'nodejs';

/** GET /api/keys — listar keys del usuario (nunca expone la key, solo prefix). */
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const supabase = createServerClient(session.token);
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, environment, active, calls_count, volume_usdc, last_used_at, created_at')
    .eq('user_id', session.sub)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Error al consultar' }, { status: 500 });
  return NextResponse.json({ keys: data ?? [] });
}

/** POST /api/keys — crea una nueva key; devuelve la key completa UNA sola vez. */
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  let body: { name?: string; environment?: ApiKeyEnvironment };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const name = body.name?.trim();
  const environment = body.environment === 'production' ? 'production' : 'test';
  if (!name) return NextResponse.json({ error: 'name requerido' }, { status: 400 });

  const generated = generateApiKey(environment);

  // service_role: insertamos solo el hash y el prefix, nunca la key en claro.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('api_keys')
    .insert({
      user_id: session.sub,
      name,
      key_prefix: generated.prefix,
      key_hash: generated.hash,
      environment,
    })
    .select('id, name, key_prefix, environment, active, created_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'No se pudo crear la key' }, { status: 500 });
  }

  return NextResponse.json(
    {
      key: data,
      // Visible una única vez:
      secret: generated.fullKey,
      warning: 'Guarda esta key ahora. No volverá a mostrarse.',
    },
    { status: 201 },
  );
}
