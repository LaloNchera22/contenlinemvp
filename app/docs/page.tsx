import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentación de la API · Contenline',
  description:
    'API pública de pagos USDC: crea checkouts, consulta sesiones y recibe webhooks firmados.',
};

// Página estática: documentación de la API pública para developers. No depende de
// sesión ni de datos del usuario, así que se prerenderiza. Es la fuente de verdad
// de la promesa pública (eventos de webhook, firma HMAC, política de retry).

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg border border-surface-border bg-surface p-4 text-xs leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-20">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm text-white/70">{children}</div>
    </section>
  );
}

export default function DocsPage() {
  return (
    <main className="min-h-screen max-w-3xl mx-auto px-6 py-16">
      <Link href="/" className="text-sm text-white/60 hover:text-white">
        ← Contenline
      </Link>

      <h1 className="mt-6 text-3xl font-bold">Documentación de la API</h1>
      <p className="mt-3 text-white/60">
        Integra pagos en USDC sobre Polygon en tu app. Crea un checkout embebible,
        deja que tu usuario pague onchain y recibe un webhook firmado cuando el pago
        se completa.
      </p>

      <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-brand-light">
        <a href="#auth" className="hover:underline">Autenticación</a>
        <a href="#checkout" className="hover:underline">Crear checkout</a>
        <a href="#sessions" className="hover:underline">Consultar sesión</a>
        <a href="#webhooks" className="hover:underline">Webhooks</a>
        <a href="#verify" className="hover:underline">Verificar la firma</a>
        <a href="#retries" className="hover:underline">Reintentos</a>
      </nav>

      <Section id="auth" title="Autenticación">
        <p>
          Todas las llamadas a <code>/api/v1/*</code> requieren una API key en el
          header <code>Authorization</code>. Genera tus keys desde el dashboard
          (sección API Keys). La key completa se muestra una sola vez.
        </p>
        <Code>{`Authorization: Bearer sk_prod_xxxxxxxxxxxxxxxx`}</Code>
        <p>
          Usa <code>sk_test_…</code> para pruebas y <code>sk_prod_…</code> en
          producción. Límite de 100 req/min por key.
        </p>
      </Section>

      <Section id="checkout" title="Crear un checkout">
        <p>
          <code>POST /api/v1/checkout</code> crea una sesión de pago y devuelve una
          URL de checkout a la que rediriges al comprador. Categorías permitidas:
          <code> onchain</code>, <code>course</code>, <code>service</code>.
        </p>
        <Code>{`curl -X POST https://contenline.app/api/v1/checkout \\
  -H "Authorization: Bearer sk_prod_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount_usdc": 25.00,
    "category": "service",
    "description": "Consultoría 1h",
    "metadata": { "order_id": "A-1001" },
    "webhook_url": "https://tuapp.com/webhooks/contenline"
  }'`}</Code>
        <p>Respuesta <code>201</code>:</p>
        <Code>{`{
  "session": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "amount_usdc": 25,
    "category": "service",
    "status": "pending",
    "expires_at": "2026-01-01T12:30:00.000Z"
  },
  "checkout_url": "https://contenline.app/checkout/f47ac10b-..."
}`}</Code>
        <p>
          <code>webhook_url</code> es opcional pero recomendado: debe ser HTTPS hacia
          un host público (rechazamos localhost e IPs privadas para evitar SSRF).
          <code> metadata</code> se devuelve íntegra en el webhook (máx. 4&nbsp;KB).
        </p>
      </Section>

      <Section id="sessions" title="Consultar una sesión">
        <p>
          <code>GET /api/v1/sessions/:id</code> devuelve el estado actual
          (<code>pending</code>, <code>completed</code>, <code>expired</code>) y el
          <code> tx_hash</code> una vez confirmado onchain.
        </p>
      </Section>

      <Section id="webhooks" title="Webhooks">
        <p>
          Cuando una sesión con <code>webhook_url</code> se completa, Contenline
          envía un <code>POST</code> firmado a tu endpoint. Tu servidor debe
          responder <strong>2xx en menos de 10&nbsp;segundos</strong>; de lo
          contrario se considera fallo y se reintenta (ver Reintentos).
        </p>
        <p>Headers de cada entrega:</p>
        <Code>{`Contenline-Signature:   <hmac-sha256-hex del cuerpo crudo>
Contenline-Timestamp:   <epoch en segundos del intento>
Contenline-Delivery-Id: <único por INTENTO>
Contenline-Event-Id:    <único por EVENTO; se repite en reintentos>`}</Code>
        <p>Estructura del payload:</p>
        <Code>{`{
  "id": "9b2e...",            // único por evento (event.id)
  "event": "payment.completed",
  "session_id": "f47ac10b-...",
  "amount_usdc": 25,
  "category": "service",
  "status": "completed",
  "tx_hash": "0xabc...",
  "metadata": { "order_id": "A-1001" },
  "timestamp": "2026-01-01T12:31:05.000Z"
}`}</Code>
        <p>Eventos disponibles:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><code>payment.completed</code> — pago único confirmado onchain.</li>
          <li><code>payment.failed</code> — el pago no pudo verificarse.</li>
          <li><code>subscription.created</code> — nueva suscripción (ver nota abajo).</li>
          <li><code>subscription.renewed</code> — renovación de una suscripción.</li>
        </ul>
        <p className="text-white/60">
          Nota: los eventos de suscripción se emiten para checkouts de suscripción
          que incluyan <code>webhook_url</code>. Las suscripciones iniciadas desde el
          perfil público del creador (sin sesión de API) no disparan webhook porque
          no hay un endpoint de developer asociado.
        </p>
      </Section>

      <Section id="verify" title="Verificar la firma (HMAC-SHA256)">
        <p>
          Firmamos el cuerpo crudo del request con HMAC-SHA256 usando tu
          <code> WEBHOOK_SIGNING_SECRET</code>. Verifica SIEMPRE la firma antes de
          confiar en el payload y compara en tiempo constante:
        </p>
        <Code>{`import crypto from 'crypto';
import express from 'express';

const app = express();
const SECRET = process.env.CONTENLINE_WEBHOOK_SECRET;

// Necesitamos el cuerpo CRUDO (sin parsear) para verificar la firma.
app.post('/webhooks/contenline',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const signature = req.header('Contenline-Signature') ?? '';
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(req.body)            // Buffer crudo
      .digest('hex');

    const ok =
      signature.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!ok) return res.status(401).send('firma inválida');

    const event = JSON.parse(req.body.toString());
    // Idempotencia: ignora si ya procesaste este event.id.
    // ... tu lógica ...
    res.status(200).send('ok');
  });`}</Code>
      </Section>

      <Section id="retries" title="Política de reintentos">
        <p>
          Si tu endpoint no responde 2xx en 10&nbsp;s, reintentamos hasta un máximo
          de <strong>5 intentos</strong> con backoff exponencial:
        </p>
        <Code>{`intento 1  → inmediato (al completarse el pago)
intento 2  → +1 min
intento 3  → +5 min
intento 4  → +30 min
intento 5  → +2 h
(tope superior del backoff: 12 h)`}</Code>
        <p>
          <strong>Idempotencia:</strong> <code>Contenline-Delivery-Id</code> es único
          por intento, mientras que <code>event.id</code> (y
          <code> Contenline-Event-Id</code>) es único por evento y se repite en los
          reintentos. Deduplica por <code>event.id</code> para no procesar dos veces
          el mismo pago.
        </p>
      </Section>
    </main>
  );
}
