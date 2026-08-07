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
    default: 'adie — Pago protegido para tus comisiones',
    template: '%s · adie',
  },
  description:
    'Cobra por tus comisiones sin miedo a que no te paguen y paga sin miedo a no recibir. adie resguarda el dinero de la comisión hasta que apruebas la entrega, protegiendo al cliente y al artista.',
  applicationName: 'adie',
  icons: {
    icon: '/adie-logo.png',
    apple: '/adie-logo.png',
  },
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
    siteName: 'adie',
    type: 'website',
  },
  formatDetection: { telephone: false },
};

export const viewport = {
  themeColor: '#F5261C',
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
