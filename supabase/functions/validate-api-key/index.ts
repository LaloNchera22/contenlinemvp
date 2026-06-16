// Edge Function: validate-api-key
// Valida una API key hasheada, aplica rate limiting y registra el uso.
// Deploy: supabase functions deploy validate-api-key

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RATE_LIMIT = 100; // req/min
const WINDOW_MS = 60_000;

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req: Request) => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    return json({ error: 'Falta Authorization Bearer' }, 401);
  }
  const rawKey = auth.slice(7).trim();
  if (!rawKey.startsWith('sk_prod_') && !rawKey.startsWith('sk_test_')) {
    return json({ error: 'Formato de key inválido' }, 401);
  }

  const keyHash = await sha256Hex(rawKey);
  const { data: key } = await admin
    .from('api_keys')
    .select('id, user_id, active')
    .eq('key_hash', keyHash)
    .eq('active', true)
    .maybeSingle();

  if (!key) return json({ error: 'API key inválida' }, 401);

  const body = await req.json().catch(() => ({}));
  const endpoint = body.endpoint ?? 'unknown';
  const ip = req.headers.get('x-forwarded-for') ?? null;

  // Rate limiting ATÓMICO: el chequeo del límite y el registro del uso ocurren en
  // una sola función SQL con advisory lock por key (igual que lib/validateApiKey.ts).
  // El patrón anterior (SELECT count + INSERT separados) tenía una race condition:
  // bajo concurrencia, N requests leían el mismo count y pasaban todas el límite.
  const { data: rl } = await admin
    .rpc('check_and_log_api_usage', {
      p_key_id: key.id,
      p_endpoint: endpoint,
      p_ip: ip,
      p_limit: RATE_LIMIT,
      p_window_seconds: WINDOW_MS / 1000,
    })
    .maybeSingle<{ allowed: boolean; request_count: number }>();

  if (rl && !rl.allowed) {
    return json({ error: 'Rate limit excedido' }, 429);
  }

  await admin.rpc('increment_api_key_calls', { key_id: key.id });
  await admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id);

  return json({ valid: true, key_id: key.id, user_id: key.user_id });
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
