'use client';

import { useRouter } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useSiweAuth } from '@/lib/useSiweAuth';

type Labels = {
  signIn: string;
  signing: string;
  connect: string;
};

/**
 * CTA principal del hero: conectar wallet → firmar SIWE → dashboard.
 * Client component aislado para que la landing pueda ser un server component
 * (necesario para metadata/SEO por idioma).
 */
export default function HeroAuth({ labels }: { labels: Labels }) {
  const { isConnected } = useAccount();
  const { signIn, loading, error } = useSiweAuth();
  const router = useRouter();

  async function handleSignIn() {
    const result = await signIn();
    if (result) router.push('/dashboard');
  }

  return (
    <div>
      {isConnected ? (
        <button onClick={handleSignIn} disabled={loading} className="btn-primary">
          {loading ? labels.signing : labels.signIn}
        </button>
      ) : (
        <ConnectButton label={labels.connect} />
      )}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}
