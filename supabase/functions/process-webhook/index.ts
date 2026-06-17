// Edge Function: process-webhook
// Notifica al developer cuando una payment session se completa.
// Firma el payload con HMAC para que el receptor pueda verificar autenticidad y
// PERSISTE cada intento en webhook_deliveries para reintentos con backoff.
//
// Invocación: POST { sessionId, webhookUrl? }. webhookUrl es informativo; la URL
// de destino se LEE de la payment_session (fuente de verdad, mitiga que un
// llamador pase una URL distinta a la validada en el checkout → SSRF).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// NOTA: lógica idéntica a lib/webhook.ts (mismo isSafeWebhookUrl +
// isPrivateOrReservedIp). Se mantiene una copia porque las Edge Functions no
// comparten el bundle de Next; cualquier cambio debe replicarse en ambos. La
// estructura se mantiene espejo (delegando en isPrivateOrReservedIp) para evitar
// divergencias sutiles entre las dos versiones.
function isSafeWebhookUrl(raw: string): boolean {
  if (raw.length === 0 || raw.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;

  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return false;
  }

  if (isPrivateOrReservedIp(host)) return false;
  return true;
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

async function hmacSha256(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Backoff exponencial entre intentos. máximo 5 intentos: la entrega inicial
// (attempts 1) más reintentos espaciados 1m, 5m, 30m, 2h. El valor de 12h es el
// tope superior del backoff (se usaría si MAX_ATTEMPTS se ampliara). Tras agotar
// los intentos, next_retry_at queda NULL y retry-webhooks deja de tomarla.
const BACKOFF_MINUTES = [1, 5, 30, 120, 720];
const MAX_ATTEMPTS = 5;

function nextRetryAt(attempts: number): string | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  const idx = Math.min(attempts - 1, BACKOFF_MINUTES.length - 1);
  return new Date(Date.now() + BACKOFF_MINUTES[idx] * 60_000).toISOString();
}

Deno.serve(async (req: Request) => {
  // Fallo CERRADO antes de procesar nada: sin el secret no podemos firmar el
  // webhook, y un secret por defecto permitiría a cualquiera forjar entregas
  // válidas (impersonación). Abortamos sin siquiera leer el body.
  const secret = Deno.env.get('WEBHOOK_SIGNING_SECRET');
  if (!secret) return json({ error: 'WEBHOOK_SIGNING_SECRET no configurado' }, 500);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { sessionId } = await req.json().catch(() => ({}));
  if (!sessionId) return json({ error: 'sessionId requerido' }, 400);

  const { data: session } = await admin
    .from('payment_sessions')
    .select('id, amount_usdc, category, status, tx_hash, webhook_url, metadata')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) return json({ error: 'Sesión no encontrada' }, 404);
  if (!session.webhook_url) return json({ ok: true, delivered: false, reason: 'sin webhook_url' });

  // Defensa en profundidad contra SSRF: aunque el checkout valida la URL al
  // crearla, revalidamos antes de hacer el fetch server-side.
  if (!isSafeWebhookUrl(session.webhook_url)) {
    return json({ ok: true, delivered: false, reason: 'webhook_url no permitida' });
  }

  const eventId = crypto.randomUUID();
  const payload = JSON.stringify({
    id: eventId,
    event: 'payment.completed',
    session_id: session.id,
    amount_usdc: session.amount_usdc,
    category: session.category,
    status: session.status,
    tx_hash: session.tx_hash,
    metadata: session.metadata,
    timestamp: new Date().toISOString(),
  });

  const signature = await hmacSha256(secret, payload);

  // Persistir el intento ANTES de hacer la request: si el proceso muere a mitad
  // del fetch, la fila ya existe y retry-webhooks la recogerá.
  const { data: delivery } = await admin
    .from('webhook_deliveries')
    .insert({
      session_id: session.id,
      webhook_url: session.webhook_url,
      payload: JSON.parse(payload),
      signature,
      attempts: 0,
    })
    .select('id')
    .single();

  // attempts pasa de 0 → 1 con esta entrega inicial.
  const attempts = 1;
  const rowId = delivery?.id ?? eventId;
  // Contenline-Delivery-Id es único por INTENTO (rowId:attempt); Event-Id es
  // único por EVENTO y se repite entre reintentos para que el receptor deduplique.
  const result = await deliver(session.webhook_url, payload, signature, `${rowId}:${attempts}`, eventId);
  const delivered = result.code >= 200 && result.code < 300;
  await admin
    .from('webhook_deliveries')
    .update({
      response_code: result.code || null,
      response_body: result.body,
      attempts,
      delivered_at: delivered ? new Date().toISOString() : null,
      next_retry_at: delivered ? null : nextRetryAt(attempts),
    })
    .eq('id', rowId);

  return json({ ok: true, delivered, responseCode: result.code });
});

/** Hace el POST firmado al endpoint del developer. Trunca el body a 1KB. */
async function deliver(
  url: string,
  payload: string,
  signature: string,
  deliveryId: string,
  eventId: string,
): Promise<{ code: number; body: string | null }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Header legacy + nombres canónicos documentados en /docs.
        'X-Contenline-Signature': signature,
        'Contenline-Signature': signature,
        'Contenline-Timestamp': String(Math.floor(Date.now() / 1000)),
        'Contenline-Delivery-Id': deliveryId,
        'Contenline-Event-Id': eventId,
      },
      body: payload,
      // El developer debe responder rápido; cortamos a 10s (ver /docs).
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text().catch(() => '');
    return { code: res.status, body: text.slice(0, 1024) || null };
  } catch (e) {
    return { code: 0, body: e instanceof Error ? e.message.slice(0, 1024) : null };
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
