import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { Providers } from './providers';
import CookieBanner from './CookieBanner';
import { localeFromPathname } from '@/lib/i18n';
import { siteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: 'Dare — Monetización cripto para creadores',
    template: '%s · Dare',
  },
  description:
    'Panel de creador + infraestructura de pagos cripto en Polygon. Suscripciones, cursos, servicios y API para developers.',
  applicationName: 'Dare',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    siteName: 'Dare',
    type: 'website',
  },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // El atributo lang debe reflejar el idioma real de la página (/​en, /pt…);
  // middleware.ts inyecta el pathname en x-pathname para poder derivarlo aquí.
  const h = headers();
  const pathname = h.get('x-pathname') ?? '/';
  const lang = localeFromPathname(pathname);
  // Nonce por request de middleware.ts: sin él la CSP bloquearía el script
  // inline que aplica el tema guardado antes del primer paint (anti-flash).
  const nonce = h.get('x-nonce') ?? undefined;

  return (
    <html lang={lang}>
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}",
          }}
        />
      </head>
      <body>
        <Providers>
          {children}
          <CookieBanner />
        </Providers>
      </body>
    </html>
  );
}
