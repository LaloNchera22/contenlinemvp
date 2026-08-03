-- =============================================================
-- AdieCoin — compliance layer (KYC/AML integration points)
-- Run AFTER schema.sql and ledger.sql in the Supabase SQL editor.
--
-- This does NOT make the platform compliant on its own. It provides the DB
-- surface a real KYC/AML program plugs into: an identity-verification status per
-- user (fed by a provider like Persona / Sumsub / Onfido via webhook) and a
-- sanctions/blocklist screening table (fed from OFAC SDN or a screening vendor).
-- The withdrawal off-ramp (the AML-sensitive step) gates on these in
-- lib/compliance.ts. Thresholds and provider wiring are configured via env vars.
-- =============================================================

-- ------------------------- KYC status on users -------------------------
-- unverified → user has not started identity verification
-- pending    → submitted, provider is reviewing
-- approved   → identity verified (can withdraw above the anonymous threshold)
-- rejected   → verification failed / denied
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'unverified'
  CHECK (kyc_status IN ('unverified','pending','approved','rejected'));
-- External reference from the KYC provider (inquiry/verification id) for audit.
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_provider_ref TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_updated_at TIMESTAMPTZ;
-- Country (ISO-3166 alpha-2) captured at verification — needed for geofencing
-- restricted jurisdictions.
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_country TEXT;

-- Append-only audit trail of every KYC status change (who/when/why). Regulators
-- expect this to be immutable and reconstructable.
CREATE TABLE IF NOT EXISTS kyc_reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_status   TEXT,
  new_status   TEXT NOT NULL,
  provider     TEXT,
  provider_ref TEXT,
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kyc_reviews_user ON kyc_reviews (user_id, created_at DESC);

-- ------------------------- Sanctions / blocklist -------------------------
-- Wallet addresses that must be blocked from depositing or withdrawing. Seed
-- from OFAC SDN crypto addresses and/or a screening vendor feed. Screening in
-- lib/compliance.ts checks deposits and withdrawals against this table.
CREATE TABLE IF NOT EXISTS blocked_addresses (
  address     TEXT PRIMARY KEY,   -- stored lowercase
  reason      TEXT,
  source      TEXT,               -- e.g. 'OFAC-SDN', 'manual', vendor name
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ------------------------- RLS -------------------------
ALTER TABLE kyc_reviews       ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_addresses ENABLE ROW LEVEL SECURITY;
-- No policies for anon/auth roles: only service_role (which bypasses RLS) reads
-- or writes these. Users learn their own kyc_status via GET /api/me.

-- ------------------------- Status transition helper -------------------------
-- Updates a user's KYC status and appends an immutable audit row atomically.
-- Called by the provider webhook handler (service_role).
CREATE OR REPLACE FUNCTION set_kyc_status(
  p_user     UUID,
  p_status   TEXT,
  p_provider TEXT,
  p_ref      TEXT,
  p_country  TEXT,
  p_note     TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old TEXT;
BEGIN
  IF p_status NOT IN ('unverified','pending','approved','rejected') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;
  SELECT kyc_status INTO old FROM users WHERE id = p_user;
  UPDATE users
    SET kyc_status = p_status,
        kyc_provider_ref = COALESCE(p_ref, kyc_provider_ref),
        kyc_country = COALESCE(p_country, kyc_country),
        kyc_updated_at = now()
    WHERE id = p_user;
  INSERT INTO kyc_reviews(user_id, old_status, new_status, provider, provider_ref, note)
    VALUES (p_user, old, p_status, p_provider, p_ref, p_note);
END;
$$;
