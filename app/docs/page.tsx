import Link from 'next/link';

export const metadata = { title: 'Docs para developers — Contenline' };

// Ejemplos de código como constantes para evitar problemas de escape en JSX.
const CURL = `curl -X POST https://tu-app.com/api/v1/checkout \\
  -H "Authorization: Bearer sk_prod_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount_usdc": 25.00,
    "category": "service",
    "description": "Consultoría 1h",
    "metadata": { "order_id": "A-1001" },
    "webhook_url": "https://tu-app.com/webhooks/contenline"
  }'`;

const NODE = `// Node.js 18+ (fetch nativo)
const res = await fetch("https://tu-app.com/api/v1/checkout", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.CONTENLINE_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    amount_usdc: 25.0,
    category: "service",
    metadata: { order_id: "A-1001" },
    webhook_url: "https://tu-app.com/webhooks/contenline",
  }),
});
const { session, checkout_url } = await res.json();
// Redirige al comprador a checkout_url para que pague onchain.`;

const PYTHON = `# Python 3 (requests)
import os, requests

res = requests.post(
    "https://tu-app.com/api/v1/checkout",
    headers={"Authorization": f"Bearer {os.environ['CONTENLINE_API_KEY']}"},
    json={
        "amount_usdc": 25.0,
        "category": "service",
        "metadata": {"order_id": "A-1001"},
        "webhook_url": "https://tu-app.com/webhooks/contenline",
    },
)
data = res.json()
print(data["checkout_url"])`;

const WEBHOOK_PAYLOAD = `{
  "event": "payment.completed",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "amount_usdc": 25.0,
  "category": "service",
  "status": "completed",
  "tx_hash": "0xabc...",
  "metadata": { "order_id": "A-1001" },
  "timestamp": "2026-06-17T12:00:00.000Z"
}`;

const HMAC_VERIFY = `// Verificación de la firma HMAC del webhook (Node.js / Express)
import crypto from "crypto";

app.post("/webhooks/contenline", express.raw({ type: "application/json" }), (req, res) => {
  const signature = req.headers["x-contenline-signature"];
  const expected = crypto
    .createHmac("sha256", process.env.WEBHOOK_SIGNING_SECRET)
    .update(req.body) // el body CRUDO, sin re-serializar
    .digest("hex");

  // Comparación en tiempo constante para evitar timing attacks.
  const ok =
    signature &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!ok) return res.status(401).send("firma inválida");

  const event = JSON.parse(req.body.toString());
  // ... procesa event.session_id, event.status, etc.
  res.sendStatus(200);
});`;

export default function DocsPage() {
  return (
    <main className="min-h-screen max-w-3xl mx-auto px-6 py-16">
      <Link href="/" className="text-sm text-white/60 hover:text-white">
        ← Inicio
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Docs para developers</h1>
      <p className="mt-2 text-white/60">
        Integra pagos en USDC sobre Polygon en tu app con una API estilo Stripe. El
        comprador paga onchain; tú recibes un webhook firmado cuando se completa.
      </p>

      <Section title="1. Obtener una API key">
        <p>
          En el dashboard ve a <strong>API Keys</strong> y crea una key. Elige el
          entorno <code>test</code> para pruebas o <code>production</code> para cobros
          reales. La key completa (<code>sk_prod_…</code> / <code>sk_test_…</code>) se
          muestra <strong>una sola vez</strong>: guárdala en un secreto de tu backend,
          nunca en el cliente. Si se filtra, revócala y genera otra.
        </p>
        <p className="mt-2">
          Todas las llamadas a <code>/api/v1/*</code> usan el header{' '}
          <code>Authorization: Bearer sk_…</code>. Límite: 100 req/min por key.
        </p>
      </Section>

      <Section title="2. Crear un checkout">
        <p>
          <code>POST /api/v1/checkout</code> crea una <em>payment session</em> y
          devuelve un <code>checkout_url</code> al que rediriges al comprador. Campos:
          <code>amount_usdc</code> (&gt;0), <code>category</code> (
          <code>onchain</code> | <code>course</code> | <code>service</code>),
          <code>description</code> (opcional), <code>metadata</code> (objeto ≤ 4 KB,
          se devuelve íntegro en el webhook) y <code>webhook_url</code> (https público).
        </p>
        <Code label="curl">{CURL}</Code>
        <Code label="Node.js">{NODE}</Code>
        <Code label="Python">{PYTHON}</Code>
      </Section>

      <Section title="3. Consultar el estado de una sesión">
        <p>
          <code>GET /api/v1/sessions/&#123;id&#125;</code> (mismo Bearer) devuelve el
          estado: <code>pending</code>, <code>completed</code> o <code>expired</code>.
          Una sesión solo es visible para la key que la creó. Útil como respaldo si te
          pierdes un webhook.
        </p>
      </Section>

      <Section title="4. Webhook de confirmación">
        <p>
          Cuando el pago se confirma onchain, Contenline hace <code>POST</code> a tu{' '}
          <code>webhook_url</code> con este payload:
        </p>
        <Code label="payload">{WEBHOOK_PAYLOAD}</Code>
        <p className="mt-2">
          La petición incluye el header <code>X-Contenline-Signature</code>: un HMAC
          SHA-256 del cuerpo crudo, firmado con tu <code>WEBHOOK_SIGNING_SECRET</code>.
          <strong> Verifícalo siempre</strong> antes de confiar en el evento:
        </p>
        <Code label="verificación HMAC (Node.js)">{HMAC_VERIFY}</Code>
      </Section>

      <Section title="5. Event types y respuestas">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <code>payment.completed</code> — único evento por ahora; se emite cuando la
            tx onchain queda verificada e idempotente por <code>tx_hash</code>.
          </li>
        </ul>
        <p className="mt-3 font-medium">Códigos de respuesta de la API:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><code>201</code> — checkout creado.</li>
          <li><code>200</code> — consulta de sesión correcta.</li>
          <li><code>400</code> — parámetros inválidos (monto, categoría, metadata, webhook_url).</li>
          <li><code>401</code> — falta el Bearer o la key es inválida/revocada.</li>
          <li><code>403</code> — la key no es dueña de la sesión consultada.</li>
          <li><code>404</code> — sesión inexistente.</li>
          <li><code>429</code> — rate limit (100 req/min por key) excedido.</li>
        </ul>
        <p className="mt-3 text-white/60 text-sm">
          Tu endpoint de webhook debe responder <code>2xx</code> para acusar recibo. Si
          falla, el evento se considera no entregado (revisa el estado vía el endpoint de
          sesiones).
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-brand-light">{title}</h2>
      <div className="mt-2 text-sm text-white/80 leading-relaxed">{children}</div>
    </section>
  );
}

function Code({ label, children }: { label: string; children: string }) {
  return (
    <figure className="mt-3">
      <figcaption className="label">{label}</figcaption>
      <pre className="overflow-x-auto rounded-lg border border-surface-border bg-surface p-4 text-xs leading-relaxed">
        <code>{children}</code>
      </pre>
    </figure>
  );
}
