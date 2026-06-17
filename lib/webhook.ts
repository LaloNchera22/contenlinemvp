/**
 * Validación de webhook_url para mitigar SSRF.
 *
 * El backend hace `fetch` server-side a esta URL (ver process-webhook). Sin
 * validación, un developer podría apuntarla a `http://localhost`, a rangos IP
 * privados o al endpoint de metadata de la nube (169.254.169.254) y forzar al
 * servidor a hacer peticiones internas / exfiltrar credenciales.
 *
 * Reglas: solo https, host público (no localhost ni IP privada/reservada).
 */
export function isSafeWebhookUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) return false;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  // Solo HTTPS hacia un host externo.
  if (url.protocol !== 'https:') return false;

  const host = url.hostname.toLowerCase();

  // Bloquear localhost y dominios internos comunes.
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return false;
  }

  // Si es una IP literal, rechazar rangos privados/reservados.
  if (isPrivateOrReservedIp(host)) return false;

  return true;
}

/**
 * Dispara la entrega del webhook al developer para una payment session.
 *
 * Delega en la Edge Function `process-webhook` en lugar de hacer el POST aquí
 * por dos razones documentadas en la arquitectura:
 *   1) La firma HMAC se mantiene del lado server (el secret WEBHOOK_SIGNING_SECRET
 *      nunca entra al bundle de Next, que es público para el cliente).
 *   2) Centraliza la lógica de persistencia + retry en un solo lugar
 *      (webhook_deliveries), evitando dos implementaciones del backoff.
 *
 * El llamador la invoca fire-and-forget (no bloquea la respuesta al confirmar la
 * tx); cualquier fallo queda registrado en webhook_deliveries para que la Edge
 * Function `retry-webhooks` lo reintente.
 */
export async function fireWebhook(sessionId: string, webhookUrl: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    // Fallo cerrado: sin estas variables no podemos firmar ni autenticar la
    // invocación a la Edge Function. Lanzamos para que el .catch() del llamador
    // lo registre en lugar de tragarse el error silenciosamente.
    throw new Error('Supabase env vars no configuradas para fireWebhook');
  }
  const res = await fetch(`${supabaseUrl}/functions/v1/process-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ sessionId, webhookUrl }),
  });
  if (!res.ok) {
    throw new Error(`Webhook delivery failed: ${res.status}`);
  }
}

function isPrivateOrReservedIp(host: string): boolean {
  // IPv6: rechazar loopback (::1), link-local (fe80::), ULA (fc00::/7) y mapeadas.
  if (host.includes(':')) {
    const h = host.replace(/^\[|\]$/g, '');
    if (h === '::1' || h === '::') return true;
    if (/^fe80:/i.test(h) || /^f[cd][0-9a-f]{2}:/i.test(h)) return true;
    return false;
  }

  const octets = host.split('.');
  if (octets.length !== 4) return false; // no es IPv4 → es un hostname
  const nums = octets.map((o) => Number(o));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;

  const [a, b] = nums;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // link-local + metadata cloud
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  return false;
}
