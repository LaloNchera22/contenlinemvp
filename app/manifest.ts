import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'adie',
    short_name: 'adie',
    description:
      'Pago protegido para comisiones: el dinero queda seguro hasta que apruebas la entrega, protegiendo al cliente y al artista.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#F5261C',
    icons: [
      {
        src: '/adie-logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
