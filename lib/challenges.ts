import { createAdminClient } from '@/lib/supabase/admin';
import { FEE_CONFIG } from '@/lib/fees';

/**
 * Server-side helpers for fan-authored challenges. The stake escrow and every
 * payout/refund are handled atomically by the SECURITY DEFINER functions in
 * supabase/ledger.sql; these wrappers just translate Postgres exceptions into
 * typed results the API routes can turn into clean HTTP responses.
 */

export const CHALLENGE_FEE_PERCENT = FEE_CONFIG.challenge * 100; // 5

export type ChallengeAction = 'accept' | 'fulfill' | 'decline' | 'cancel';

export class LedgerError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = 'LedgerError';
  }
}

/** Maps a Postgres RAISE EXCEPTION message to a known error code (or rethrows). */
function toLedgerError(message: string): LedgerError {
  const known = [
    'insufficient_balance',
    'cannot_challenge_self',
    'challenge_not_found',
    'forbidden',
    'invalid_transition',
    'unknown_action',
  ];
  const hit = known.find((k) => message.includes(k));
  return new LedgerError(hit ?? 'ledger_error');
}

/**
 * Opens a challenge: debits and escrows the fan's stake, creates the row.
 * Returns the new challenge id. Throws LedgerError('insufficient_balance') etc.
 */
export async function openChallenge(params: {
  fromUserId: string;
  creatorId: string;
  title: string;
  description: string | null;
  stakeAusd: number;
}): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('challenge_open', {
    p_from: params.fromUserId,
    p_creator: params.creatorId,
    p_title: params.title,
    p_desc: params.description,
    p_stake: params.stakeAusd,
    p_fee: CHALLENGE_FEE_PERCENT,
  });
  if (error) throw toLedgerError(error.message);
  return data as string;
}

/**
 * Applies an action (accept/fulfill/decline/cancel) to a challenge, moving the
 * escrowed funds accordingly. Returns the resulting status.
 */
export async function actOnChallenge(
  challengeId: string,
  actorId: string,
  action: ChallengeAction,
): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('challenge_act', {
    p_id: challengeId,
    p_actor: actorId,
    p_action: action,
  });
  if (error) throw toLedgerError(error.message);
  return data as string;
}
