import { createAdminClient } from '@/lib/supabase/admin';

export interface RateLimitResult {
  allowed: boolean;
  count: number;
}

/**
 * Rate limiting por IP (o identificador genérico, p. ej. user_id) para endpoints
 * sin API key. Reutiliza el mismo patrón atómico de check_and_log_api_usage pero
 * contra la tabla ip_rate_limit: una función SQL con advisory lock por hash(ip+bucket)
 * serializa conteo + inserción, cerrando la race condition de hacerlo en dos pasos.
 *
 * Política de fallo ABIERTO: si la IP no se puede determinar o la función SQL aún
 * no está desplegada, NO bloqueamos la request. Estos endpoints ya tienen otras
 * defensas (validación onchain en confirm, límite por wallet en nonce); el rate
 * limit por IP es una capa extra anti-DoS, no el control de seguridad principal.
 * Bloquear por un schema desactualizado causaría más daño que el abuso que previene.
 */
export async function checkIpRateLimit(
  ip: string | null | undefined,
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  if (!ip) return { allowed: true, count: 0 };

  const admin = createAdminClient();
  const { data, error } = await admin
    .rpc('check_ip_rate_limit', {
      p_ip: ip,
      p_bucket: key,
      p_limit: limit,
      p_window_sec: windowSec,
    })
    .maybeSingle<{ allowed: boolean; request_count: number }>();

  if (error || !data) {
    // Fallo abierto (ver nota arriba).
    return { allowed: true, count: 0 };
  }
  return { allowed: data.allowed, count: data.request_count };
}

/** Extrae la IP del cliente del header estándar de proxy. */
export function clientIp(req: { headers: { get(name: string): string | null } }): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}
