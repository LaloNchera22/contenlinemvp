import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import {
  LIMITS,
  requireString,
  optionalString,
  validateAmount,
  isValidationError,
} from '@/lib/validation';
import { openChallenge, LedgerError } from '@/lib/challenges';

export const runtime = 'nodejs';

type ChallengeRow = {
  id: string;
  from_user_id: string;
  creator_id: string;
  title: string;
  description: string | null;
  stake_ausd: number;
  fee_percent: number;
  status: string;
  created_at: string;
  updated_at: string;
};

/** Attaches display_name/username to each challenge's counterpart users. */
async function withUsers(
  supabase: ReturnType<typeof createServerClient>,
  rows: ChallengeRow[],
) {
  const ids = Array.from(new Set(rows.flatMap((r) => [r.from_user_id, r.creator_id])));
  const map = new Map<string, { username: string; display_name: string }>();
  if (ids.length > 0) {
    const { data } = await supabase.from('users').select('id, username, display_name').in('id', ids);
    for (const u of data ?? []) map.set(u.id, { username: u.username, display_name: u.display_name });
  }
  return rows.map((r) => ({
    ...r,
    from_user: map.get(r.from_user_id) ?? null,
    creator: map.get(r.creator_id) ?? null,
  }));
}

/**
 * GET /api/challenges — challenges where the user is either the creator
 * (incoming) or the author/fan (outgoing). RLS scopes both to the participant.
 */
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const supabase = createServerClient(session.token);
  const { data, error } = await supabase
    .from('challenges')
    .select('id, from_user_id, creator_id, title, description, stake_ausd, fee_percent, status, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: 'Error al consultar' }, { status: 500 });

  const rows = (data ?? []) as ChallengeRow[];
  const enriched = await withUsers(supabase, rows);
  return NextResponse.json({
    incoming: enriched.filter((r) => r.creator_id === session.sub),
    outgoing: enriched.filter((r) => r.from_user_id === session.sub),
  });
}

/**
 * POST /api/challenges — a fan authors a paid challenge and sends it to a
 * creator, staking AUSD from their internal balance (escrowed immediately).
 * body: { creator_username | creator_id, title, description?, stake_ausd }
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  let body: {
    creator_username?: string;
    creator_id?: string;
    title?: string;
    description?: string;
    stake_ausd?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const title = requireString(body.title, 'title', 3, LIMITS.challenge_title);
  if (isValidationError(title)) return NextResponse.json(title, { status: 400 });

  const description = optionalString(body.description, 'description', LIMITS.challenge_description);
  if (isValidationError(description)) return NextResponse.json(description, { status: 400 });

  const stake = validateAmount(body.stake_ausd);
  if (isValidationError(stake)) return NextResponse.json(stake, { status: 400 });

  const supabase = createServerClient(session.token);

  // Resolve the target creator (by username or id). users has a public-read RLS
  // policy, so this works under the fan's own token.
  let creatorId = body.creator_id ?? null;
  if (!creatorId && body.creator_username) {
    const { data: creator } = await supabase
      .from('users')
      .select('id')
      .eq('username', body.creator_username.toLowerCase())
      .maybeSingle();
    creatorId = creator?.id ?? null;
  }
  if (!creatorId) {
    return NextResponse.json({ error: 'Creador no encontrado' }, { status: 404 });
  }
  if (creatorId === session.sub) {
    return NextResponse.json({ error: 'No puedes enviarte un reto a ti mismo' }, { status: 400 });
  }

  try {
    const id = await openChallenge({
      fromUserId: session.sub,
      creatorId,
      title,
      description,
      stakeAusd: stake,
    });
    return NextResponse.json({ id, status: 'pending' }, { status: 201 });
  } catch (e) {
    if (e instanceof LedgerError) {
      if (e.code === 'insufficient_balance') {
        return NextResponse.json(
          { error: 'Saldo AUSD insuficiente para financiar el reto' },
          { status: 402 },
        );
      }
      if (e.code === 'cannot_challenge_self') {
        return NextResponse.json({ error: 'No puedes enviarte un reto a ti mismo' }, { status: 400 });
      }
    }
    return NextResponse.json({ error: 'No se pudo crear el reto' }, { status: 500 });
  }
}
