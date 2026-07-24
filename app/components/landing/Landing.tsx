import Link from 'next/link';
import { headers } from 'next/headers';
import { dictionaries, locales, localePath, type Locale } from '@/lib/i18n';
import { siteUrl } from '@/lib/seo';
import HeroAuth from './HeroAuth';
import HeaderWallet from './HeaderWallet';

/**
 * Landing pública multilenguaje (server component). El look sigue el sistema
 * visual de Supabase: fondo neutro oscuro, acento verde, hero de dos columnas
 * y cards de producto con checklist.
 */
export default function Landing({ locale }: { locale: Locale }) {
  const dict = dictionaries[locale];
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
        name: 'Contenline',
        url: base.toString(),
        description: dict.meta.description,
      },
      {
        '@type': 'WebSite',
        '@id': new URL('/#website', base).toString(),
        name: 'Contenline',
        url: base.toString(),
        inLanguage: locales.map((l) => l),
        publisher: { '@id': new URL('/#organization', base).toString() },
      },
      {
        '@type': 'SoftwareApplication',
        name: 'Contenline',
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web',
        url: new URL(localePath(locale), base).toString(),
        description: dict.meta.description,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
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

      <header className="sticky top-0 z-20 border-b border-sep bg-surface backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <Link href={localePath(locale)} className="flex items-center gap-2 text-lg font-bold">
              <LogoMark />
              Conten<span className="text-ink">line</span>
            </Link>
            <nav className="hidden items-center gap-5 text-sm text-muted sm:flex">
              <Link href="/docs" className="hover:text-ink">
                {dict.nav.docs}
              </Link>
              <Link href="/dashboard" className="hover:text-ink">
                {dict.nav.dashboard}
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher current={locale} />
            <HeaderWallet />
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 pb-16 pt-20 md:grid-cols-2 md:gap-16 md:pt-28">
        <div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            {dict.hero.line1}
            <br />
            <span className="text-ink">{dict.hero.line2}</span>
          </h1>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <HeroAuth
              labels={{
                signIn: dict.hero.signIn,
                signing: dict.hero.signing,
                connect: dict.hero.connect,
              }}
            />
            <Link href="/docs" className="btn-ghost">
              {dict.hero.secondaryCta}
            </Link>
          </div>
        </div>
        <div className="flex items-start md:pt-3">
          <p className="max-w-xl text-lg leading-relaxed text-muted">{dict.hero.body}</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-6 pb-20 md:grid-cols-3">
        {dict.features.map((f, i) => (
          <article key={f.title} className="card p-6">
            <div className="flex items-center gap-3">
              <span className="text-muted">{FEATURE_ICONS[i]}</span>
              <h2 className="font-semibold">{f.title}</h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{f.body}</p>
            <ul className="mt-5 space-y-2">
              {f.bullets.map((b) => (
                <li key={b} className="flex items-center gap-2 text-sm text-muted">
                  <CheckIcon />
                  {b}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="border-t border-sep bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="text-center text-sm font-medium uppercase tracking-widest text-muted">
            {dict.stack.title}
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {dict.stack.items.map((item) => (
              <div key={item.name} className="rounded-control border border-sep bg-surface p-4">
                <p className="font-mono text-sm text-ink">{item.name}</p>
                <p className="mt-1 text-xs text-muted">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-sep px-6 py-8 text-center text-sm text-muted">
        <p>{dict.footer.tagline}</p>
        <nav className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link href="/dashboard" className="hover:text-ink">
            {dict.footer.dashboard}
          </Link>
          <Link href="/docs" className="hover:text-ink">
            {dict.footer.docs}
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            {dict.footer.privacy}
          </Link>
          <Link href="/terms" className="hover:text-ink">
            {dict.footer.terms}
          </Link>
          <Link href="/cookies" className="hover:text-ink">
            {dict.footer.cookies}
          </Link>
        </nav>
        <div className="mt-4 flex items-center justify-center gap-2 text-xs">
          <span className="text-muted">{dict.footer.language}:</span>
          <LanguageSwitcher current={locale} />
        </div>
      </footer>
    </main>
  );
}

function LanguageSwitcher({ current }: { current: Locale }) {
  return (
    <nav aria-label="Idiomas" className="flex items-center gap-1 text-xs font-medium">
      {locales.map((l) => (
        <Link
          key={l}
          href={localePath(l)}
          hrefLang={l}
          className={`rounded-control px-1.5 py-0.5 uppercase transition-colors ${
            l === current ? 'bg-sep text-ink' : 'text-muted hover:text-ink'
          }`}
        >
          {l}
        </Link>
      ))}
    </nav>
  );
}

function LogoMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M13 2 3 14h7l-1 8 12-14h-8l0-6z" fill="#3ECF8E" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path d="M5 12.5 10 17.5 19 7" stroke="#3ECF8E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const FEATURE_ICONS = [
  // Panel de creador
  <svg key="0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 4v5" />
  </svg>,
  // Infra de pagos
  <svg key="1" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M2 10h20M6 14h4" />
  </svg>,
  // Seguridad Web3
  <svg key="2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
    <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3z" />
    <path d="m9 12 2 2 4-4" />
  </svg>,
];
