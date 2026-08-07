'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { polygon, polygonAmoy } from 'wagmi/chains';

// La red la decide NEXT_PUBLIC_CHAIN_ID (mismo criterio que lib/chain.ts):
// exponer una sola cadena evita que el usuario firme/transaccione en una red
// distinta a la que el backend valida en /api/transactions/confirm.
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? '137');

export const wagmiConfig = getDefaultConfig({
  appName: 'adie',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'demo',
  chains: [chainId === 80002 ? polygonAmoy : polygon],
  ssr: true,
});
