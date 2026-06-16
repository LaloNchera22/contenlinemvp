// Edge Function: process-webhook
// Notifica al developer cuando una payment session se completa.
// Firma el payload con HMAC para que el receptor pueda verificar autenticidad.

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

  // Defensa en profundidad contra SSRF: aunque el checkout valida la URL al
  // crearla, revalidamos antes de hacer el fetch server-side.
  if (!isSafeWebhookUrl(session.webhook_url)) {
    return json({ ok: true, delivered: false, reason: 'webhook_url no permitida' });
  }

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

  // Sin fallback: un secreto por defecto en producción permitiría a cualquiera
  // forjar webhooks válidos. Si no está configurado, abortamos en vez de firmar
  // con un secreto conocido.
  const secret = Deno.env.get('WEBHOOK_SIGNING_SECRET');
  if (!secret) return json({ error: 'WEBHOOK_SIGNING_SECRET no configurado' }, 500);
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
