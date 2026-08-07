import Link from 'next/link';
import Image from 'next/image';
import { headers } from 'next/headers';
import { siteUrl } from '@/lib/seo';

/**
 * Landing pública de adie (server component), en español y en pesos.
 *
 * Reemplaza la antigua landing de wallet/stablecoin. El producto que se
 * comunica aquí es uno solo: un pago protegido para comisiones entre un cliente
 * y un artista. El dinero queda resguardado hasta que el cliente aprueba la
 * entrega. NO se muestran datos bancarios ni CLABE: el pago se coordina en
 * privado por cada comisión.
 *
 * El look reutiliza el sistema visual de `/comision/[id]`: cards neutras,
 * acento de marca y pasos numerados. Móvil primero.
 */

// Contacto real y configurable por entorno, igual que en /comision/[id].
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'hola@adie.app';

// mailto con asunto y cuerpo prellenados: un visitante pide su link de comisión
// sin que la landing exponga ningún dato de pago.
const REQUEST_MAILTO =
  `mailto:${SUPPORT_EMAIL}` +
  '?subject=' +
  encodeURIComponent('Solicito mi link de comisión') +
  '&body=' +
  encodeURIComponent(
    'Hola adie:\n\n' +
      'Quiero solicitar un link de comisión con pago protegido.\n\n' +
      '• Soy: (cliente / artista)\n' +
      '• Descripción del trabajo:\n' +
      '• Monto acordado (MXN):\n' +
      '• Nombre de la otra persona:\n\n' +
      'Gracias.',
  );

const STEPS = [
  {
    t: 'Depositas',
    d: 'Coordinas el pago y el monto queda resguardado. El artista aún no lo recibe.',
  },
  {
    t: 'El artista entrega',
    d: 'El artista realiza el trabajo y te lo entrega para que lo revises con calma.',
  },
  {
    t: 'Apruebas y se libera',
    d: 'Cuando estás conforme, apruebas y recién entonces se libera el pago.',
  },
];

export default function PublicLanding() {
  // Nonce por request que inyecta middleware.ts: sin él la CSP (script-src
  // 'nonce-…') bloquearía el JSON-LD inline.
  const nonce = headers().get('x-nonce') ?? undefined;

  const base = siteUrl();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': new URL('/#organization', base).toString(),
        name: 'adie',
        url: base.toString(),
        description:
          'Pago protegido para comisiones: el dinero queda seguro hasta que apruebas la entrega.',
      },
      {
        '@type': 'WebSite',
        '@id': new URL('/#website', base).toString(),
        name: 'adie',
        url: base.toString(),
        inLanguage: 'es',
        publisher: { '@id': new URL('/#organization', base).toString() },
      },
    ],
  };

  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header — marca única "adie" en minúscula, sin navegación a secciones privadas. */}
      <header className="sticky top-0 z-20 border-b border-surface-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-center gap-2" aria-label="adie">
            <Image src="/adie-logo.png" alt="adie" width={28} height={28} priority />
            <span className="text-sm font-semibold text-ink">adie</span>
          </Link>
          <span className="text-[11px] uppercase tracking-wide text-ink/50">Pago protegido</span>
        </div>
      </header>

      {/* Hero — mensaje central y un único CTA. */}
      <section className="mx-auto max-w-3xl px-5 pt-14 pb-10 sm:pt-20">
        <p className="text-xs uppercase tracking-wide text-ink/60">Comisiones sin miedo</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl lg:text-5xl">
          Cobra por tus comisiones sin miedo a que no te paguen;{' '}
          <span className="text-brand">
            el cliente paga sin miedo a no recibir.
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-ink/70 sm:text-lg">
          adie resguarda el dinero de la comisión hasta que el trabajo se entrega y
          se aprueba. El artista trabaja con la seguridad de que va a cobrar; el
          cliente paga con la seguridad de que va a recibir.
        </p>
        <div className="mt-8">
          <a href={REQUEST_MAILTO} className="btn-primary w-full sm:w-auto">
            Solicita tu link de comisión
          </a>
        </div>
      </section>

      {/* Cómo funciona — 3 pasos, reutilizando el estilo de /comision/[id]. */}
      <section className="border-t border-surface-border bg-surface-card/40">
        <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
          <h2 className="text-xl font-bold text-ink sm:text-2xl">Cómo funciona</h2>
          <p className="mt-2 text-sm text-ink/60">En tres pasos, sin sorpresas.</p>
          <ol className="mt-6 space-y-4">
            {STEPS.map((step, i) => (
              <li key={step.t} className="card flex gap-4">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold text-ink">{step.t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink/70">{step.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Por qué es seguro — el dinero protegido hasta la aprobación. */}
      <section className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <h2 className="text-xl font-bold text-ink sm:text-2xl">Por qué es seguro</h2>
        <div className="mt-6 space-y-4">
          <article className="card border-brand/30 bg-brand/5">
            <p className="text-base font-semibold leading-snug text-ink sm:text-lg">
              El dinero queda protegido hasta la aprobación.{' '}
              <span className="text-brand">Nadie cobra por adelantado.</span>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink/70">
              El monto de la comisión se resguarda desde el inicio. El artista no lo
              recibe hasta que entregas y el cliente aprueba. Así protegemos a los dos.
            </p>
          </article>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="card">
              <p className="font-semibold text-ink">Protege al artista</p>
              <p className="mt-1 text-sm leading-relaxed text-ink/70">
                Empiezas a trabajar sabiendo que el pago ya está resguardado. Se acabó
                entregar y quedarte esperando que te paguen.
              </p>
            </article>
            <article className="card">
              <p className="font-semibold text-ink">Protege al cliente</p>
              <p className="mt-1 text-sm leading-relaxed text-ink/70">
                Tu dinero no se libera hasta que recibes lo acordado y lo apruebas. Si
                algo no cuadra, el pago no se suelta.
              </p>
            </article>
          </div>
        </div>

        <div className="mt-8">
          <a href={REQUEST_MAILTO} className="btn-primary w-full sm:w-auto">
            Solicita tu link de comisión
          </a>
        </div>
      </section>

      {/* Footer — contacto real y enlaces legales. */}
      <footer className="border-t border-surface-border px-5 py-10 text-center text-sm text-ink/60">
        <p className="font-semibold text-ink">adie</p>
        <p className="mt-2">
          ¿Dudas antes de empezar?{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-ink/80 underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
        <nav className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link href="/privacy" className="hover:text-ink">
            Privacidad
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Términos
          </Link>
          <Link href="/cookies" className="hover:text-ink">
            Cookies
          </Link>
        </nav>
        <p className="mt-4 text-xs text-ink/40">
          El pago se coordina en privado por cada comisión.
        </p>
      </footer>
    </main>
  );
}
