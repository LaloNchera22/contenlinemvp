import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AdieCoin',
    short_name: 'AdieCoin',
    description:
      'The stablecoin wallet for creators: an internal AUSD balance for recurring subscriptions, content and fan challenges — funded by USDC on Polygon.',
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
