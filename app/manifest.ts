import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Contenline',
    short_name: 'Contenline',
    description:
      'Monetización cripto para creadores: suscripciones, cursos y servicios con pagos en USDC sobre Polygon.',
    start_url: '/',
    display: 'standalone',
    background_color: '#121212',
    theme_color: '#121212',
    icons: [],
  };
}
