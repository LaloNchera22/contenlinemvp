import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AdieCoin',
    short_name: 'AdieCoin',
    description:
      'The stablecoin wallet for creators: an internal AUSD balance for recurring subscriptions, content and fan challenges — funded by USDC on Polygon.',
    start_url: '/',
    display: 'standalone',
    background_color: '#121212',
    theme_color: '#121212',
    icons: [],
  };
}
