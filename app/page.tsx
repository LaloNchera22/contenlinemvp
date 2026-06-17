'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useSiweAuth } from '@/lib/useSiweAuth';

export default function Home() {
  const { isConnected } = useAccount();
  const { signIn, loading, error } = useSiweAuth();
  const router = useRouter();

  async function handleSignIn() {
    const result = await signIn();
    if (result) router.push('/dashboard');
  }

  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
        <span className="text-xl font-bold">
          Conten<span className="text-brand">line</span>
        </span>
        <ConnectButton />
      </header>

      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h1 className="text-5xl font-bold leading-tight">
          Monetización cripto unificada para{' '}
          <span className="text-brand">creadores</span>
        </h1>
        <p className="mt-6 text-lg text-white/60 max-w-2xl mx-auto">
          Gestiona suscripciones, cursos y servicios con pagos en USDC sobre Polygon.
          Y ofrece a developers una API de pagos cripto — todo en un solo dashboard.
        </p>

        <div className="mt-10 flex items-center justify-center gap-4">
          {isConnected ? (
            <button onClick={handleSignIn} disabled={loading} className="btn-primary">
              {loading ? 'Firmando…' : 'Iniciar sesión con Ethereum'}
            </button>
          ) : (
            <ConnectButton label="Conecta tu wallet para empezar" />
          )}
        </div>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </section>

      <section className="max-w-5xl mx-auto px-6 grid md:grid-cols-3 gap-5 pb-24">
        <Feature title="Panel de creador" body="Contenido exclusivo, cursos y servicios con acceso controlado por suscripción onchain." />
        <Feature title="Infra de pagos" body="API keys estilo Stripe para integrar pagos USDC en tu propia app." />
        <Feature title="Seguridad Web3" body="SIWE, RLS en Supabase, verificación onchain y signed URLs para contenido privado." />
      </section>

      <footer className="border-t border-surface-border px-6 py-6 text-center text-sm text-white/60">
        <p>Contenline · Protocolo non-custodial de pagos en USDC sobre Polygon</p>
        <nav className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link href="/dashboard" className="hover:text-white">
            Dashboard
          </Link>
          <Link href="/docs" className="hover:text-white">
            API · Docs
          </Link>
          <Link href="/privacy" className="hover:text-white">
            Privacidad
          </Link>
          <Link href="/terms" className="hover:text-white">
            Términos
          </Link>
          <Link href="/cookies" className="hover:text-white">
            Cookies
          </Link>
        </nav>
      </footer>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="card text-left">
      <h3 className="font-semibold text-brand-light">{title}</h3>
      <p className="mt-2 text-sm text-white/60">{body}</p>
    </div>
  );
}
