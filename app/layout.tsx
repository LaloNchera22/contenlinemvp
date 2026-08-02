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
    default: 'AdieCoin — The stablecoin wallet for creators',
    template: '%s · AdieCoin',
  },
  description:
    'A stablecoin balance (AUSD) for every creator. Deposit USDC once, then run recurring subscriptions, sell content and accept fan challenges — settled instantly from your internal balance, non-custodial.',
  applicationName: 'AdieCoin',
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
    siteName: 'AdieCoin',
    type: 'website',
  },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // El atributo lang debe reflejar el idioma real de la página (/​en, /pt…);
  // middleware.ts inyecta el pathname en x-pathname para poder derivarlo aquí.
  const pathname = headers().get('x-pathname') ?? '/';
  const lang = localeFromPathname(pathname);

  return (
    <html lang={lang}>
      <body>
        <Providers>
          {children}
          <CookieBanner />
        </Providers>
      </body>
    </html>
  );
}
