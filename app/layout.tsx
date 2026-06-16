import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import CookieBanner from './CookieBanner';

export const metadata: Metadata = {
  title: 'Contenline — Monetización cripto para creadores',
  description:
    'Panel de creador + infraestructura de pagos cripto en Polygon. Suscripciones, cursos, servicios y API para developers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>
          {children}
          <CookieBanner />
        </Providers>
      </body>
    </html>
  );
}
