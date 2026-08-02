-- =============================================================
-- AdieCoin — internal stablecoin ledger + fan challenges
-- Run AFTER schema.sql in the Supabase SQL editor.
--
-- AUSD is AdieCoin's internal unit of account, pegged 1:1 to deposited USDC.
-- Balances live in `wallets`; every movement is recorded append-only in
-- `ledger_entries`. All mutations go through the SECURITY DEFINER functions
-- below (advisory-locked per user) so concurrent debits can never race the
-- balance negative — the same discipline used by the rate-limit functions in
-- schema.sql.
-- =============================================================

-- ----------------------------- TABLES -----------------------------

-- One internal balance per user. Never written directly by clients: only the
-- ledger functions touch it (they keep it in sync with ledger_entries).
CREATE TABLE IF NOT EXISTS wallets (
  user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance_ausd NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (balance_ausd >= 0),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Append-only ledger. amount_ausd is SIGNED (+credit / -debit); balance_after
-- snapshots the resulting balance so a statement can be reconstructed without
-- replaying every row.
CREATE TABLE IF NOT EXISTS ledger_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_type    TEXT NOT NULL CHECK (entry_type IN (
                  'deposit','withdrawal',
                  'subscription_charge','subscription_payout',
                  'challenge_stake','challenge_payout','challenge_refund',
                  'fee')),
  amount_ausd   NUMERIC(18,6) NOT NULL,
  balance_after NUMERIC(18,6) NOT NULL,
  ref_type      TEXT,
  ref_id        TEXT,
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger_entries (user_id, created_at DESC);

-- On-chain USDC deposits that funded the internal balance. tx_hash UNIQUE makes
-- crediting idempotent: replaying the same deposit is a no-op.
CREATE TABLE IF NOT EXISTS deposits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tx_hash       TEXT UNIQUE NOT NULL,
  amount_usdc   NUMERIC(18,6) NOT NULL,
  amount_ausd   NUMERIC(18,6) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Fan-authored challenges/commissions sent to a creator. The fan stakes AUSD
-- (held in escrow the moment the challenge is opened); the creator accepts and
-- delivers to release it (minus fee), or it is declined/cancelled and refunded.
CREATE TABLE IF NOT EXISTS challenges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL CHECK (length(title) <= 120),
  description   TEXT CHECK (description IS NULL OR length(description) <= 1000),
  stake_ausd    NUMERIC(18,6) NOT NULL CHECK (stake_ausd > 0),
  fee_percent   NUMERIC(5,2) NOT NULL DEFAULT 5,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                  'pending','accepted','fulfilled','declined','cancelled','expired')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT challenge_not_self CHECK (from_user_id <> creator_id)
);
CREATE INDEX IF NOT EXISTS idx_challenges_creator ON challenges (creator_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenges_from ON challenges (from_user_id, created_at DESC);

-- ----------------------------- RLS -----------------------------
-- Reads are owner/participant scoped. Writes happen only through the SECURITY
-- DEFINER functions below (invoked with service_role), so no INSERT/UPDATE
-- policies are granted to anon/auth roles.

ALTER TABLE wallets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits       ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS owner_wallet ON wallets;
CREATE POLICY owner_wallet ON wallets
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS owner_ledger ON ledger_entries;
CREATE POLICY owner_ledger ON ledger_entries
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS owner_deposits ON deposits;
CREATE POLICY owner_deposits ON deposits
  FOR SELECT USING (user_id = auth.uid());

-- Both the fan who authored it and the target creator can read a challenge.
DROP POLICY IF EXISTS challenge_participant_read ON challenges;
CREATE POLICY challenge_participant_read ON challenges
  FOR SELECT USING (from_user_id = auth.uid() OR creator_id = auth.uid());

-- ----------------------------- FUNCTIONS -----------------------------

-- Internal credit helper: upserts the wallet, bumps the balance and appends a
-- ledger row. Caller MUST already hold the per-user advisory lock. Returns the
-- new balance.
CREATE OR REPLACE FUNCTION ledger_apply(
  p_user        UUID,
  p_type        TEXT,
  p_amount      NUMERIC,   -- signed
  p_ref_type    TEXT,
  p_ref_id      TEXT,
  p_description TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance NUMERIC;
BEGIN
  INSERT INTO wallets(user_id, balance_ausd, updated_at)
    VALUES (p_user, 0, now())
    ON CONFLICT (user_id) DO NOTHING;

  UPDATE wallets
    SET balance_ausd = balance_ausd + p_amount,
        updated_at = now()
    WHERE user_id = p_user
    RETURNING balance_ausd INTO new_balance;

  -- The CHECK (balance_ausd >= 0) on wallets turns an over-debit into an error
  -- here; callers that debit must verify sufficiency first for a clean message.
  INSERT INTO ledger_entries(user_id, entry_type, amount_ausd, balance_after, ref_type, ref_id, description)
    VALUES (p_user, p_type, p_amount, new_balance, p_ref_type, p_ref_id, p_description);

  RETURN new_balance;
END;
$$;

-- Credit an on-chain USDC deposit to the internal AUSD balance. Idempotent by
-- tx_hash (replays return the current balance without double-crediting).
CREATE OR REPLACE FUNCTION ausd_deposit(
  p_user    UUID,
  p_tx_hash TEXT,
  p_usdc    NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  bal NUMERIC;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user::text));

  IF EXISTS (SELECT 1 FROM deposits WHERE tx_hash = p_tx_hash) THEN
    SELECT balance_ausd INTO bal FROM wallets WHERE user_id = p_user;
    RETURN COALESCE(bal, 0);
  END IF;

  INSERT INTO deposits(user_id, tx_hash, amount_usdc, amount_ausd)
    VALUES (p_user, p_tx_hash, p_usdc, p_usdc);

  bal := ledger_apply(p_user, 'deposit', p_usdc, 'deposit', p_tx_hash,
                      'USDC deposit → AUSD');
  RETURN bal;
END;
$$;

-- Open a fan-authored challenge: stake is debited from the fan's balance and
-- held. Raises 'insufficient_balance' if the fan can't cover the stake.
CREATE OR REPLACE FUNCTION challenge_open(
  p_from    UUID,
  p_creator UUID,
  p_title   TEXT,
  p_desc    TEXT,
  p_stake   NUMERIC,
  p_fee     NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  bal NUMERIC;
  new_id UUID;
BEGIN
  IF p_from = p_creator THEN
    RAISE EXCEPTION 'cannot_challenge_self';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_from::text));

  SELECT balance_ausd INTO bal FROM wallets WHERE user_id = p_from;
  IF bal IS NULL OR bal < p_stake THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  INSERT INTO challenges(from_user_id, creator_id, title, description, stake_ausd, fee_percent, status)
    VALUES (p_from, p_creator, p_title, p_desc, p_stake, p_fee, 'pending')
    RETURNING id INTO new_id;

  PERFORM ledger_apply(p_from, 'challenge_stake', -p_stake, 'challenge', new_id::text,
                       'Stake held for challenge');
  RETURN new_id;
END;
$$;

-- Act on a challenge. Actions:
--   accept  (creator): pending  → accepted
--   fulfill (creator): accepted → fulfilled  (net stake released to creator)
--   decline (creator): pending/accepted → declined  (stake refunded to fan)
--   cancel  (fan):     pending  → cancelled  (stake refunded to fan)
-- Returns the new status. Raises on invalid actor/transition.
CREATE OR REPLACE FUNCTION challenge_act(
  p_id     UUID,
  p_actor  UUID,
  p_action TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ch        challenges%ROWTYPE;
  fee_amt   NUMERIC;
  net_amt   NUMERIC;
  new_status TEXT;
BEGIN
  -- Serialize concurrent actions on the same challenge.
  PERFORM pg_advisory_xact_lock(hashtext(p_id::text));

  SELECT * INTO ch FROM challenges WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'challenge_not_found';
  END IF;

  IF p_action = 'cancel' THEN
    IF p_actor <> ch.from_user_id THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF ch.status <> 'pending' THEN RAISE EXCEPTION 'invalid_transition'; END IF;
    PERFORM pg_advisory_xact_lock(hashtext(ch.from_user_id::text));
    PERFORM ledger_apply(ch.from_user_id, 'challenge_refund', ch.stake_ausd, 'challenge', ch.id::text,
                         'Challenge cancelled — stake refunded');
    new_status := 'cancelled';

  ELSIF p_action = 'accept' THEN
    IF p_actor <> ch.creator_id THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF ch.status <> 'pending' THEN RAISE EXCEPTION 'invalid_transition'; END IF;
    new_status := 'accepted';

  ELSIF p_action = 'decline' THEN
    IF p_actor <> ch.creator_id THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF ch.status NOT IN ('pending','accepted') THEN RAISE EXCEPTION 'invalid_transition'; END IF;
    PERFORM pg_advisory_xact_lock(hashtext(ch.from_user_id::text));
    PERFORM ledger_apply(ch.from_user_id, 'challenge_refund', ch.stake_ausd, 'challenge', ch.id::text,
                         'Challenge declined — stake refunded');
    new_status := 'declined';

  ELSIF p_action = 'fulfill' THEN
    IF p_actor <> ch.creator_id THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF ch.status <> 'accepted' THEN RAISE EXCEPTION 'invalid_transition'; END IF;
    fee_amt := round(ch.stake_ausd * ch.fee_percent / 100, 6);
    net_amt := ch.stake_ausd - fee_amt;
    PERFORM pg_advisory_xact_lock(hashtext(ch.creator_id::text));
    PERFORM ledger_apply(ch.creator_id, 'challenge_payout', net_amt, 'challenge', ch.id::text,
                         'Challenge fulfilled — payout (net of fee)');
    new_status := 'fulfilled';

  ELSE
    RAISE EXCEPTION 'unknown_action';
  END IF;

  UPDATE challenges SET status = new_status, updated_at = now() WHERE id = p_id;
  RETURN new_status;
END;
$$;
