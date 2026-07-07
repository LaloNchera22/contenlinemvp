'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

/** Wrapper client del ConnectButton para usarlo desde el header (server component). */
export default function HeaderWallet() {
  return <ConnectButton showBalance={false} />;
}
