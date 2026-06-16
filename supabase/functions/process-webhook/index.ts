// Edge Function: process-webhook
// Notifica al developer cuando una payment session se completa.
// Firma el payload con HMAC para que el receptor pueda verificar autenticidad.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

Deno.serve(async (req: Request) => {
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

  const payload = JSON.stringify({
    event: 'payment.completed',
    session_id: session.id,
    amount_usdc: session.amount_usdc,
    category: session.category,
    status: session.status,
    tx_hash: session.tx_hash,
    metadata: session.metadata,
    timestamp: new Date().toISOString(),
  });

  const secret = Deno.env.get('WEBHOOK_SIGNING_SECRET') ?? 'dev-secret';
  const signature = await hmacSha256(secret, payload);

  let delivered = false;
  let responseCode = 0;
  try {
    const res = await fetch(session.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Contenline-Signature': signature,
      },
      body: payload,
    });
    responseCode = res.status;
    delivered = res.ok;
  } catch (_e) {
    delivered = false;
  }

  return json({ ok: true, delivered, responseCode });
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
