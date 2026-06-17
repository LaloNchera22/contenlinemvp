import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/auth';
import { safeHttpsUrl } from '@/lib/url';
import SubscribeButton from './SubscribeButton';
import ContentItem from './ContentItem';
// AgeGate queda deshabilitado temporalmente (decisión BLOQUE 3.3): el contenido
// sexualmente explícito está prohibido hasta integrar KYC de creadores adultos.
// El componente se conserva en ./AgeGate.tsx para rehabilitarlo cuando exista KYC.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ContentRow = {
  id: string;
  title: string;
  media_type: 'image' | 'video' | 'document' | null;
  is_exclusive: boolean;
};

async function getCreator(username: string) {
  const admin = createAdminClient();
  const { data: user } = await admin
    .from('users')
    .select('id, wallet, username, display_name, bio, avatar_url, is_adult')
    .eq('username', username)
    .maybeSingle();
  if (!user) return null;

  const { data: plans } = await admin
    .from('subscription_plans')
    .select('id, name, price_usdc, interval, description, onchain_plan_id')
    .eq('creator_id', user.id)
    .eq('active', true);

  const { data: content } = await admin
    .from('content')
    .select('id, title, media_type, is_exclusive')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })
    .limit(24);

  return { user, plans: plans ?? [], content: (content ?? []) as ContentRow[] };
}

/**
 * ¿El visitante tiene una suscripción activa a este creador? Leemos la sesión
 * (cookie httpOnly) en el server: si no hay sesión, no está suscrito. Esto decide
 * si el contenido exclusivo se muestra clickeable o blureado con candado.
 */
async function viewerHasActiveSub(creatorId: string): Promise<boolean> {
  const session = getSessionFromRequest();
  if (!session?.wallet) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from('subscriptions')
    .select('id')
    .eq('creator_id', creatorId)
    .ilike('subscriber_wallet', session.wallet)
    .eq('active', true)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return !!data;
}

export default async function CreatorPage({ params }: { params: { username: string } }) {
  const data = await getCreator(params.username);
  if (!data) notFound();
  const { user, plans, content } = data;
  const avatar = safeHttpsUrl(user.avatar_url);
  const subscribed = await viewerHasActiveSub(user.id);

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-6 py-16">
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 rounded-full bg-brand/30 overflow-hidden">
          {avatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt={user.display_name} className="h-full w-full object-cover" />
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
          <p className="text-sm text-white/60">Este creador aún no publicó planes.</p>
        )}
        {plans.map((p) => (
          <div key={p.id} className="card">
            <p className="font-semibold text-brand-light">{p.name}</p>
            {p.description && <p className="text-sm text-white/60 mt-1">{p.description}</p>}
            <p className="mt-3 text-2xl font-bold">
              ${Number(p.price_usdc).toFixed(2)}{' '}
              <span className="text-sm font-normal text-white/60">
                USDC / {p.interval === 'monthly' ? 'mes' : 'año'}
              </span>
            </p>
            {p.onchain_plan_id != null ? (
              <SubscribeButton
                onchainPlanId={p.onchain_plan_id}
                creatorWallet={user.wallet}
                priceUsdc={Number(p.price_usdc)}
              />
            ) : (
              <p className="mt-4 text-xs text-white/60">
                Plan no disponible para suscripción onchain todavía.
              </p>
            )}
          </div>
        ))}
      </div>

      <h2 className="mt-12 text-lg font-semibold">Contenido reciente</h2>
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
        {content.length === 0 && (
          <p className="text-sm text-white/60">Este creador aún no publicó contenido.</p>
        )}
        {content.map((c) => {
          // Exclusivo + sin suscripción activa: thumbnail blureado con candado.
          // No exponemos ni el título completo ni la media; solo el CTA a suscribirse.
          const locked = c.is_exclusive && !subscribed;
          if (locked) {
            return (
              <div
                key={c.id}
                className="card aspect-square flex flex-col items-center justify-center text-center relative overflow-hidden"
                aria-label="Contenido exclusivo bloqueado"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-brand/20 to-surface blur-sm" aria-hidden />
                <span className="relative text-2xl" aria-hidden>🔒</span>
                <span className="relative text-xs text-white/70 mt-2 px-2">Suscríbete para ver</span>
              </div>
            );
          }
          return (
            <ContentItem key={c.id} id={c.id} title={c.title} mediaType={c.media_type} />
          );
        })}
      </div>
    </main>
  );
}
