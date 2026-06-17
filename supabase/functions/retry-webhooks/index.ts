// Edge Function: retry-webhooks  (cron cada 5 minutos)
// Reintenta las entregas de webhook que fallaron y cuyo next_retry_at ya venció.
// Programar: supabase functions deploy retry-webhooks + schedule '*/5 * * * *'.
//
// Reutiliza el payload y la firma HMAC YA persistidos en webhook_deliveries: la
// firma cubre el payload (que incluye su timestamp original), así que NO se
// re-firma — reintentar con la misma firma mantiene la verificación válida y el
// event.id estable para que el receptor deduplique.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Espejo de process-webhook: máximo 5 intentos, mismo backoff.
const BACKOFF_MINUTES = [1, 5, 30, 120, 720];
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 50;

function nextRetryAt(attempts: number): string | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  const idx = Math.min(attempts - 1, BACKOFF_MINUTES.length - 1);
  return new Date(Date.now() + BACKOFF_MINUTES[idx] * 60_000).toISOString();
}

Deno.serve(async () => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Pendientes: no entregadas, con intentos disponibles y cuyo retry ya tocó.
  const { data: pending } = await admin
    .from('webhook_deliveries')
    .select('id, webhook_url, payload, signature, attempts')
    .is('delivered_at', null)
    .lt('attempts', MAX_ATTEMPTS)
    .lte('next_retry_at', new Date().toISOString())
    .order('next_retry_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (!pending || pending.length === 0) {
    return json({ ok: true, retried: 0, delivered: 0 });
  }

  let delivered = 0;
  for (const row of pending) {
    const payloadStr = JSON.stringify(row.payload);
    const eventId = (row.payload as { id?: string })?.id ?? row.id;
    const attempts = (row.attempts ?? 0) + 1;
    const result = await deliver(
      row.webhook_url,
      payloadStr,
      row.signature,
      `${row.id}:${attempts}`,
      eventId,
    );
    const ok = result.code >= 200 && result.code < 300;
    if (ok) delivered++;
    await admin
      .from('webhook_deliveries')
      .update({
        response_code: result.code || null,
        response_body: result.body,
        attempts,
        delivered_at: ok ? new Date().toISOString() : null,
        next_retry_at: ok ? null : nextRetryAt(attempts),
      })
      .eq('id', row.id);
  }

  return json({ ok: true, retried: pending.length, delivered });
});

/** POST firmado al endpoint del developer. Reutiliza la firma persistida. */
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
        'X-Contenline-Signature': signature,
        'Contenline-Signature': signature,
        'Contenline-Timestamp': String(Math.floor(Date.now() / 1000)),
        'Contenline-Delivery-Id': deliveryId,
        'Contenline-Event-Id': eventId,
      },
      body: payload,
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
