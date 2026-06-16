import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Contenline — Monetización cripto para creadores',
  description:
    'Panel de creador + infraestructura de pagos cripto en Polygon. Suscripciones, cursos, servicios y API para developers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
