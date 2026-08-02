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

export type WithdrawResult = { withdrawalId: string; balance: number };

/**
 * Requests an AUSD → USDC withdrawal. The balance is debited atomically inside
 * ausd_withdraw (advisory-locked per user); the on-chain USDC payout from the
 * treasury is settled out-of-band by a treasury signer. Throws
 * 'insufficient_balance' when the user can't cover the amount.
 */
export async function requestWithdrawal(
  userId: string,
  toAddress: string,
  amountAusd: number,
): Promise<WithdrawResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('ausd_withdraw', {
    p_user: userId,
    p_to: toAddress,
    p_amount: amountAusd,
  });
  if (error) throw new Error(error.message);
  const row = data as { withdrawal_id: string; balance: number };
  return { withdrawalId: row.withdrawal_id, balance: Number(row.balance) };
}
