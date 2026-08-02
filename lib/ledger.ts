import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Server-side helpers for the internal AUSD ledger. Every balance mutation goes
 * through a SECURITY DEFINER Postgres function (supabase/ledger.sql) so debits
 * are advisory-locked per user and can never race the balance negative.
 */

export type LedgerEntry = {
  id: string;
  entry_type: string;
  amount_ausd: number;
  balance_after: number;
  ref_type: string | null;
  ref_id: string | null;
  description: string | null;
  created_at: string;
};

/**
 * Credits an on-chain USDC deposit to the user's internal AUSD balance.
 * Idempotent by txHash. Returns the new balance.
 */
export async function creditDeposit(
  userId: string,
  txHash: string,
  amountUsdc: number,
): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('ausd_deposit', {
    p_user: userId,
    p_tx_hash: txHash,
    p_usdc: amountUsdc,
  });
  if (error) throw new Error(error.message);
  return Number(data);
}
