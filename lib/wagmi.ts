'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { polygon, polygonMumbai } from 'wagmi/chains';

export const wagmiConfig = getDefaultConfig({
  appName: 'Contenline',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'demo',
  chains: [polygon, polygonMumbai],
  ssr: true,
});
