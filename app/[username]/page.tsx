import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import SubscribeButton from './SubscribeButton';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getCreator(username: string) {
  const admin = createAdminClient();
  const { data: user } = await admin
    .from('users')
    .select('id, wallet, username, display_name, bio, avatar_url')
    .eq('username', username)
    .maybeSingle();
  if (!user) return null;

  const { data: plans } = await admin
    .from('subscription_plans')
    .select('id, name, price_usdc, interval, description')
    .eq('creator_id', user.id)
    .eq('active', true);

  return { user, plans: plans ?? [] };
}

export default async function CreatorPage({ params }: { params: { username: string } }) {
  const data = await getCreator(params.username);
  if (!data) notFound();
  const { user, plans } = data;

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-6 py-16">
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 rounded-full bg-brand/30 overflow-hidden">
          {user.avatar_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar_url} alt={user.display_name} className="h-full w-full object-cover" />
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{user.display_name}</h1>
          <p className="text-white/50">@{user.username}</p>
        </div>
      </div>

      {user.bio && <p className="mt-6 text-white/70">{user.bio}</p>}

      <h2 className="mt-12 text-lg font-semibold">Planes de suscripción</h2>
      <div className="mt-4 grid sm:grid-cols-2 gap-4">
        {plans.length === 0 && (
          <p className="text-sm text-white/40">Este creador aún no publicó planes.</p>
        )}
        {plans.map((p) => (
          <div key={p.id} className="card">
            <p className="font-semibold text-brand-light">{p.name}</p>
            {p.description && <p className="text-sm text-white/60 mt-1">{p.description}</p>}
            <p className="mt-3 text-2xl font-bold">
              ${Number(p.price_usdc).toFixed(2)}{' '}
              <span className="text-sm font-normal text-white/40">
                USDC / {p.interval === 'monthly' ? 'mes' : 'año'}
              </span>
            </p>
            <SubscribeButton
              planId={p.id}
              creatorWallet={user.wallet}
              priceUsdc={Number(p.price_usdc)}
            />
          </div>
        ))}
      </div>
    </main>
  );
}
