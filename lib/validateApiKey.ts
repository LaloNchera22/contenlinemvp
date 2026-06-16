import { createAdminClient } from '@/lib/supabase/admin';
import { hashApiKey, detectEnvironment } from '@/lib/apiKeys';

const RATE_LIMIT = 100; // req por minuto por key
const WINDOW_MS = 60 * 1000;

export interface ApiKeyContext {
  id: string;
  user_id: string;
  environment: string;
}

export type ValidationResult =
  | { ok: true; key: ApiKeyContext }
  | { ok: false; status: number; error: string };

/**
 * Valida una API key Bearer:
 *  - hashea la key recibida y la busca por key_hash + active
 *  - aplica rate limiting (100/min) vía api_key_usage
 *  - registra el uso (auditoría)
 */
export async function validateApiKey(
  authHeader: string | null,
  meta: { endpoint: string; ip?: string },
): Promise<ValidationResult> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Falta Authorization Bearer' };
  }
  const rawKey = authHeader.slice(7).trim();
  if (!detectEnvironment(rawKey)) {
    return { ok: false, status: 401, error: 'Formato de key inválido' };
  }

  const admin = createAdminClient();
  const keyHash = hashApiKey(rawKey);

  const { data: key } = await admin
    .from('api_keys')
    .select('id, user_id, environment, active')
    .eq('key_hash', keyHash)
    .eq('active', true)
    .maybeSingle();

  if (!key) {
    return { ok: false, status: 401, error: 'API key inválida o revocada' };
  }

  // Rate limiting por ventana de 1 minuto.
  const windowStart = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count } = await admin
    .from('api_key_usage')
    .select('id', { count: 'exact', head: true })
    .eq('api_key_id', key.id)
    .gte('created_at', windowStart);

  if ((count ?? 0) >= RATE_LIMIT) {
    await logUsage(admin, key.id, meta, 429);
    return { ok: false, status: 429, error: 'Rate limit excedido (100/min)' };
  }

  await logUsage(admin, key.id, meta, 200);
  await admin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', key.id);
  // incremento atómico del contador (función SQL en schema.sql)
  await admin.rpc('increment_api_key_calls', { key_id: key.id }).then(
    () => undefined,
    () => undefined, // si la función no existe aún, no bloqueamos la request
  );

  return { ok: true, key: { id: key.id, user_id: key.user_id, environment: key.environment } };
}

async function logUsage(
  admin: ReturnType<typeof createAdminClient>,
  apiKeyId: string,
  meta: { endpoint: string; ip?: string },
  responseCode: number,
) {
  await admin.from('api_key_usage').insert({
    api_key_id: apiKeyId,
    endpoint: meta.endpoint,
    ip: meta.ip ?? null,
    response_code: responseCode,
  });
}
