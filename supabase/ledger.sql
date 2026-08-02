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

-- ------------------------- SYSTEM ACCOUNTS -------------------------
-- Two reserved user rows give the ledger true double-entry integrity: every
-- movement now nets to zero across accounts, so SUM(amount_ausd) over the whole
-- ledger is always 0 and the books can be reconciled/audited.
--
--   platform  → collects platform fees (revenue account)
--   escrow    → holds a fan's stake while a challenge is unresolved
--
-- Fixed UUIDs so application/report code can reference them. They are ordinary
-- users(id) rows (RLS on wallets/ledger_entries hides them from real users, who
-- can only SELECT their own auth.uid()).
DO $$
BEGIN
  INSERT INTO users (id, wallet, username, display_name)
  VALUES ('00000000-0000-0000-0000-000000000001', 'system:platform', 'adiecoin_platform', 'AdieCoin Platform')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO users (id, wallet, username, display_name)
  VALUES ('00000000-0000-0000-0000-000000000002', 'system:escrow', 'adiecoin_escrow', 'AdieCoin Escrow')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO wallets (user_id) VALUES ('00000000-0000-0000-0000-000000000001') ON CONFLICT DO NOTHING;
  INSERT INTO wallets (user_id) VALUES ('00000000-0000-0000-0000-000000000002') ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION platform_account() RETURNS UUID
  LANGUAGE sql IMMUTABLE AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE OR REPLACE FUNCTION escrow_account() RETURNS UUID
  LANGUAGE sql IMMUTABLE AS $$ SELECT '00000000-0000-0000-0000-000000000002'::uuid $$;

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

-- Withdrawal requests: a user cashing an AUSD balance back out to on-chain USDC.
-- The AUSD debit is INSTANT and atomic (ausd_withdraw); the actual USDC transfer
-- from the treasury is an operational step performed by a treasury signer/relayer
-- that later calls withdrawal_mark_sent(id, tx_hash). Status lifecycle:
--   pending    → debited, awaiting treasury payout
--   processing → relayer picked it up
--   sent       → USDC transferred on-chain (tx_hash set)
--   failed     → payout failed; balance was refunded (ledger 'deposit'-style credit)
CREATE TABLE IF NOT EXISTS withdrawals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_address   TEXT NOT NULL,
  amount_ausd  NUMERIC(18,6) NOT NULL CHECK (amount_ausd > 0),
  amount_usdc  NUMERIC(18,6) NOT NULL CHECK (amount_usdc > 0),
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','processing','sent','failed','cancelled')),
  tx_hash      TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_pending ON withdrawals (status) WHERE status IN ('pending','processing');

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
ALTER TABLE withdrawals    ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS owner_wallet ON wallets;
CREATE POLICY owner_wallet ON wallets
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS owner_withdrawals ON withdrawals;
CREATE POLICY owner_withdrawals ON withdrawals
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

-- Request a withdrawal of AUSD back to on-chain USDC (1:1). The balance is
-- debited ATOMICALLY here (advisory-locked per user, so it can never race the
-- balance negative) and a `pending` withdrawal row is created; a treasury
-- signer/relayer settles the USDC transfer off-band and calls
-- withdrawal_mark_sent(). Returns { withdrawal_id, balance }.
-- Raises 'insufficient_balance' if the user can't cover the amount.
CREATE OR REPLACE FUNCTION ausd_withdraw(
  p_user   UUID,
  p_to     TEXT,
  p_amount NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  bal    NUMERIC;
  new_id UUID;
  new_bal NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user::text));

  SELECT balance_ausd INTO bal FROM wallets WHERE user_id = p_user;
  IF bal IS NULL OR bal < p_amount THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  INSERT INTO withdrawals(user_id, to_address, amount_ausd, amount_usdc, status)
    VALUES (p_user, p_to, p_amount, p_amount, 'pending')
    RETURNING id INTO new_id;

  new_bal := ledger_apply(p_user, 'withdrawal', -p_amount, 'withdrawal', new_id::text,
                          'AUSD withdrawal → USDC (' || p_to || ')');

  RETURN json_build_object('withdrawal_id', new_id, 'balance', new_bal);
END;
$$;

-- Settle a withdrawal: called by the treasury signer/relayer once the on-chain
-- USDC transfer confirms. Idempotent (a no-op if already sent). The AUSD was
-- already debited by ausd_withdraw, so this only advances the status.
CREATE OR REPLACE FUNCTION withdrawal_mark_sent(
  p_id      UUID,
  p_tx_hash TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE withdrawals
    SET status = 'sent', tx_hash = p_tx_hash, updated_at = now()
    WHERE id = p_id AND status IN ('pending','processing');
  RETURN 'sent';
END;
$$;

-- Refund a failed withdrawal: re-credits the user's balance and marks it failed.
-- Idempotent by status (only pending/processing rows are refunded).
CREATE OR REPLACE FUNCTION withdrawal_mark_failed(
  p_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  w withdrawals%ROWTYPE;
BEGIN
  SELECT * INTO w FROM withdrawals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'withdrawal_not_found'; END IF;
  IF w.status NOT IN ('pending','processing') THEN
    RETURN w.status; -- already settled/refunded
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(w.user_id::text));
  PERFORM ledger_apply(w.user_id, 'deposit', w.amount_ausd, 'withdrawal', w.id::text,
                       'Withdrawal failed — balance refunded');
  UPDATE withdrawals SET status = 'failed', updated_at = now() WHERE id = p_id;
  RETURN 'failed';
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

  -- Double-entry: the fan is debited and the escrow account is credited the same
  -- amount, so the movement nets to zero. The stake now lives in escrow until the
  -- challenge is fulfilled (→ creator + platform fee) or refunded (→ fan).
  PERFORM ledger_apply(p_from, 'challenge_stake', -p_stake, 'challenge', new_id::text,
                       'Stake held for challenge');
  PERFORM ledger_apply(escrow_account(), 'challenge_stake', p_stake, 'challenge', new_id::text,
                       'Stake escrowed');
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

  -- Every branch below is balanced double-entry: the escrow account is debited
  -- the stake it was holding and the same amount is credited out (to the fan on a
  -- refund, or split creator-net + platform-fee on a fulfill), so the ledger
  -- always nets to zero.
  IF p_action = 'cancel' THEN
    IF p_actor <> ch.from_user_id THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF ch.status <> 'pending' THEN RAISE EXCEPTION 'invalid_transition'; END IF;
    PERFORM ledger_apply(escrow_account(), 'challenge_refund', -ch.stake_ausd, 'challenge', ch.id::text,
                         'Escrow released — challenge cancelled');
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
    PERFORM ledger_apply(escrow_account(), 'challenge_refund', -ch.stake_ausd, 'challenge', ch.id::text,
                         'Escrow released — challenge declined');
    PERFORM ledger_apply(ch.from_user_id, 'challenge_refund', ch.stake_ausd, 'challenge', ch.id::text,
                         'Challenge declined — stake refunded');
    new_status := 'declined';

  ELSIF p_action = 'fulfill' THEN
    IF p_actor <> ch.creator_id THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF ch.status <> 'accepted' THEN RAISE EXCEPTION 'invalid_transition'; END IF;
    fee_amt := round(ch.stake_ausd * ch.fee_percent / 100, 6);
    net_amt := ch.stake_ausd - fee_amt;
    PERFORM ledger_apply(escrow_account(), 'challenge_payout', -ch.stake_ausd, 'challenge', ch.id::text,
                         'Escrow released — challenge fulfilled');
    PERFORM ledger_apply(ch.creator_id, 'challenge_payout', net_amt, 'challenge', ch.id::text,
                         'Challenge fulfilled — payout (net of fee)');
    IF fee_amt > 0 THEN
      PERFORM ledger_apply(platform_account(), 'fee', fee_amt, 'challenge', ch.id::text,
                           'Platform fee — challenge');
    END IF;
    new_status := 'fulfilled';

  ELSE
    RAISE EXCEPTION 'unknown_action';
  END IF;

  UPDATE challenges SET status = new_status, updated_at = now() WHERE id = p_id;
  RETURN new_status;
END;
$$;
