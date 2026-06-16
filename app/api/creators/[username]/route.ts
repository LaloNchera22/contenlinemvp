import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/** GET /api/creators/[username] — perfil público + planes y cursos publicados. */
export async function GET(_req: NextRequest, { params }: { params: { username: string } }) {
  const admin = createAdminClient();

  const { data: user } = await admin
    .from('users')
    .select('id, wallet, username, display_name, bio, avatar_url, created_at')
    .eq('username', params.username)
    .maybeSingle();

  if (!user) return NextResponse.json({ error: 'Creador no encontrado' }, { status: 404 });

  const [{ data: plans }, { data: courses }, { data: services }] = await Promise.all([
    admin
      .from('subscription_plans')
      .select('id, name, price_usdc, interval, description')
      .eq('creator_id', user.id)
      .eq('active', true),
    admin
      .from('courses')
      .select('id, title, description, price_usdc, cover_url')
      .eq('creator_id', user.id)
      .eq('published', true),
    admin
      .from('services')
      .select('id, title, description, price_usdc')
      .eq('creator_id', user.id)
      .eq('active', true),
  ]);

  return NextResponse.json({
    creator: user,
    plans: plans ?? [],
    courses: courses ?? [],
    services: services ?? [],
  });
}
