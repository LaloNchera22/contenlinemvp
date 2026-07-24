'use client';

import { ReactNode, useEffect, useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { wagmiConfig } from '@/lib/wagmi';

// Acento acromático para el modal de wallet: el chrome nunca lleva color de
// marca, tampoco el de un tercero.
const ACCENT = '#1D1D1F';

function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => {
      const forced = document.documentElement.getAttribute('data-theme');
      if (forced === 'dark') return setDark(true);
      if (forced === 'light') return setDark(false);
      setDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
    };
    read();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', read);
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', read);
      obs.disconnect();
    };
  }, []);
  return dark;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const dark = useIsDark();

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={
            dark
              ? darkTheme({ accentColor: '#F5F5F7', accentColorForeground: '#000000' })
              : lightTheme({ accentColor: ACCENT, accentColorForeground: '#FFFFFF' })
          }
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
