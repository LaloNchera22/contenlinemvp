import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import CheckoutClient from './CheckoutClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getSession(id: string) {
  if (!UUID_V4.test(id)) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from('payment_sessions')
    .select('id, amount_usdc, category, description, status, expires_at, creator_id')
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;

  const { data: creator } = await admin
    .from('users')
    .select('wallet, display_name, username')
    .eq('id', data.creator_id)
    .maybeSingle();
  if (!creator) return null;

  return { session: data, creator };
}

export default async function CheckoutPage({ params }: { params: { id: string } }) {
  const data = await getSession(params.id);
  if (!data) notFound();
  const { session, creator } = data;

  const expired =
    session.status === 'expired' ||
    (session.status === 'pending' && new Date(session.expires_at) < new Date());

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="card w-full max-w-md">
        <p className="text-xs uppercase tracking-wide text-white/60">Pago seguro · Contenline</p>
        <h1 className="mt-2 text-2xl font-bold">
          ${Number(session.amount_usdc).toFixed(2)} <span className="text-base font-normal text-white/60">USDC</span>
        </h1>
        <p className="mt-1 text-sm text-white/70">
          {session.description || `Pago a ${creator.display_name}`}
        </p>
        <p className="mt-1 text-xs text-white/60">
          Para @{creator.username} · categoría {session.category}
        </p>

        {session.status === 'completed' ? (
          <p className="mt-6 text-sm text-green-400">Este pago ya fue completado. ✓</p>
        ) : expired ? (
          <p className="mt-6 text-sm text-amber-400">Esta sesión de pago expiró.</p>
        ) : (
          <CheckoutClient
            sessionId={session.id}
            creatorWallet={creator.wallet}
            amountUsdc={Number(session.amount_usdc)}
            category={session.category}
          />
        )}

        <p className="mt-6 text-[11px] leading-relaxed text-white/50">
          Contenline es un protocolo non-custodial: el pago se ejecuta directamente
          entre tu wallet y la del creador. La plataforma no custodia fondos.
        </p>
      </div>
    </main>
  );
}
