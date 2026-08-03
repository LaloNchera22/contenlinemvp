import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Compliance gates for the money-movement paths (KYC/AML).
 *
 * These enforce policy in the app layer so thresholds and jurisdiction rules are
 * configurable via env vars without a migration. They are the enforcement half of
 * the DB surface in supabase/compliance.sql — they do NOT replace a real KYC/AML
 * program (identity provider + sanctions vendor + a compliance officer), they are
 * the integration point that program plugs into.
 */

export type KycStatus = 'unverified' | 'pending' | 'approved' | 'rejected';

/**
 * Cumulative AUSD a user may withdraw WITHOUT completing identity verification.
 * Above this, KYC must be 'approved'. Default 0 = KYC required for any
 * withdrawal (the safe default for an off-ramp); relax via env for a
 * low-friction small-amount tier.
 */
export function kycThresholdAusd(): number {
  const raw = Number(process.env.KYC_REQUIRED_ABOVE_AUSD ?? '0');
  return Number.isFinite(raw) && raw >= 0 ? raw : 0;
}

/** ISO-3166 alpha-2 codes the service is geofenced out of (comma-separated env). */
export function restrictedCountries(): Set<string> {
  return new Set(
    (process.env.RESTRICTED_COUNTRIES ?? '')
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
  );
}

export type WithdrawGate = { allowed: true } | { allowed: false; reason: string; code: string };

/**
 * Decides whether a withdrawal of `amount` AUSD is permitted for a user with the
 * given KYC state. Pure and unit-tested — no I/O.
 */
export function canWithdraw(
  kycStatus: KycStatus,
  amount: number,
  opts?: { country?: string | null },
): WithdrawGate {
  if (kycStatus === 'rejected') {
    return { allowed: false, code: 'kyc_rejected', reason: 'Tu verificación de identidad fue rechazada.' };
  }

  const country = opts?.country?.toUpperCase();
  if (country && restrictedCountries().has(country)) {
    return { allowed: false, code: 'restricted_region', reason: 'El servicio no está disponible en tu región.' };
  }

  if (amount > kycThresholdAusd() && kycStatus !== 'approved') {
    return {
      allowed: false,
      code: 'kyc_required',
      reason: 'Debes completar la verificación de identidad (KYC) para retirar este monto.',
    };
  }

  return { allowed: true };
}

/**
 * Sanctions/blocklist screening for a wallet address. Checks the
 * `blocked_addresses` table (seeded from OFAC SDN or a screening vendor).
 * Fails CLOSED on a lookup error for the withdrawal path — an off-ramp must not
 * pay out while screening is unavailable.
 */
export async function isBlockedAddress(
  admin: SupabaseClient,
  address: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('blocked_addresses')
    .select('address')
    .eq('address', address.toLowerCase())
    .maybeSingle();
  if (error) return true; // fail closed
  return !!data;
}
