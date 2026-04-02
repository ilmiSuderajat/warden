-- ============================================================
-- MIGRATION v2 PATCHED: Hardened Wallet, Payment, Refund & Ledger System
-- Patches applied:
--   [P1] orders table stub — prevents "relation does not exist" on first run
--   [P2] nested dollar-quoting fix in pg_cron verify_all_hash_chains
--   [P3] total_amount column explicitly ensured on orders
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- SECTION 0: EXTENSIONS
-- ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_cron;


-- ────────────────────────────────────────────────────────────
-- [P1] SECTION 0b: ORDERS TABLE STUB
-- Must exist before transactions (which FK references it) and
-- before wallets migration adds columns to it.
-- If orders already exists in your schema, this is a safe no-op.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_amount  NUMERIC     NOT NULL DEFAULT 0,   -- [P3] explicit column
  status        TEXT        NOT NULL DEFAULT 'Menunggu Pembayaran',
  payment_status TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ────────────────────────────────────────────────────────────
-- SECTION 1: CORE TABLES
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wallets (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance    NUMERIC     NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT balance_non_negative CHECK (balance >= 0)
);

CREATE TABLE IF NOT EXISTS transactions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  seq              BIGSERIAL   NOT NULL UNIQUE,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id         UUID        REFERENCES orders(id) ON DELETE SET NULL,
  type             TEXT        NOT NULL CHECK (type IN ('payment','refund','topup','withdraw','commission')),
  amount           NUMERIC     NOT NULL,
  balance_after    NUMERIC     NOT NULL,
  description      TEXT,
  idempotency_key  TEXT        UNIQUE,
  prev_hash        TEXT        NOT NULL,
  hash             TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT amount_non_zero    CHECK (amount <> 0),
  CONSTRAINT payment_negative   CHECK (type != 'payment' OR amount < 0),
  CONSTRAINT refund_positive    CHECK (type != 'refund'  OR amount > 0),
  CONSTRAINT no_duplicate_tx    UNIQUE (order_id, type)
);

-- [P3] Ensure total_amount exists even if orders was pre-existing without it
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS total_amount  NUMERIC     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS canceled_by   TEXT,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS canceled_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_refunded   BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_status TEXT;

CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID,
  actor_role  TEXT        NOT NULL,
  action      TEXT        NOT NULL,
  target_id   UUID,
  payload     JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pending_refunds (
  order_id    UUID        PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  attempts    INT         NOT NULL DEFAULT 0,
  last_error  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retry_after TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ────────────────────────────────────────────────────────────
-- SECTION 2: PERFORMANCE INDEXES
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_transactions_user_seq
  ON transactions(user_id, seq DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_idempotency
  ON transactions(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_pending_refunds_retry
  ON pending_refunds(retry_after)
  WHERE attempts < 5;


-- ────────────────────────────────────────────────────────────
-- SECTION 3: ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

ALTER TABLE wallets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallets_select_own"      ON wallets;
DROP POLICY IF EXISTS "transactions_select_own" ON transactions;

CREATE POLICY "wallets_select_own" ON wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "transactions_select_own" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

-- audit_log, pending_refunds: no client policies — service_role only


-- ────────────────────────────────────────────────────────────
-- SECTION 4: RPC FUNCTIONS
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _write_audit_log(
  p_actor_id   UUID,
  p_actor_role TEXT,
  p_action     TEXT,
  p_target_id  UUID,
  p_payload    JSONB
) RETURNS VOID AS $$
BEGIN
  INSERT INTO audit_log (actor_id, actor_role, action, target_id, payload)
  VALUES (p_actor_id, p_actor_role, p_action, p_target_id, p_payload);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


CREATE OR REPLACE FUNCTION create_transaction(
  p_user_id         UUID,
  p_order_id        UUID,
  p_type            TEXT,
  p_amount          NUMERIC,
  p_description     TEXT,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS transactions AS $$
DECLARE
  v_existing   transactions;
  v_prev_hash  TEXT;
  v_new_hash   TEXT;
  v_balance    NUMERIC;
  v_bal_after  NUMERIC;
  v_row        transactions;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM transactions WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN v_existing; END IF;
  END IF;

  SELECT balance INTO v_balance
  FROM wallets WHERE user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO wallets (user_id, balance)
    VALUES (p_user_id, 0) ON CONFLICT (user_id) DO NOTHING;
    v_balance := 0;
  END IF;

  SELECT hash INTO v_prev_hash
  FROM transactions WHERE user_id = p_user_id
  ORDER BY seq DESC LIMIT 1;

  v_prev_hash := COALESCE(v_prev_hash, 'GENESIS');

  v_new_hash := encode(
    digest(
      p_user_id::TEXT
      || COALESCE(p_order_id::TEXT, '')
      || p_type
      || p_amount::TEXT
      || v_prev_hash,
      'sha256'
    ), 'hex'
  );

  v_bal_after := v_balance + p_amount;

  INSERT INTO transactions (
    user_id, order_id, type, amount, balance_after,
    description, idempotency_key, prev_hash, hash
  ) VALUES (
    p_user_id, p_order_id, p_type, p_amount, v_bal_after,
    p_description, p_idempotency_key, v_prev_hash, v_new_hash
  ) RETURNING * INTO v_row;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


CREATE OR REPLACE FUNCTION process_payment(
  p_order_id        UUID,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_order   orders%ROWTYPE;
  v_balance NUMERIC;
BEGIN
  PERFORM pg_try_advisory_xact_lock(hashtext(auth.uid()::text));

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.user_id != auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF v_order.payment_status = 'paid' THEN RAISE EXCEPTION 'Already paid'; END IF;

  INSERT INTO wallets (user_id, balance) VALUES (auth.uid(), 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance FROM wallets WHERE user_id = auth.uid() FOR UPDATE;

  IF v_balance < v_order.total_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE wallets SET balance = balance - v_order.total_amount, updated_at = NOW()
  WHERE user_id = auth.uid();

  PERFORM create_transaction(
    auth.uid(), p_order_id, 'payment', -v_order.total_amount,
    'Payment for order ' || p_order_id, p_idempotency_key
  );

  UPDATE orders SET payment_status = 'paid', status = 'Perlu Dikemas' WHERE id = p_order_id;

  PERFORM _write_audit_log(
    auth.uid(), 'user', 'process_payment', p_order_id,
    jsonb_build_object(
      'total_amount', v_order.total_amount,
      'balance_before', v_balance,
      'balance_after', v_balance - v_order.total_amount
    )
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


CREATE OR REPLACE FUNCTION refund_order(
  p_order_id UUID,
  p_internal BOOLEAN DEFAULT FALSE
) RETURNS BOOLEAN AS $$
DECLARE
  v_order   orders%ROWTYPE;
  v_balance NUMERIC;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF NOT p_internal AND v_order.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_order.status = 'Selesai'     THEN RAISE EXCEPTION 'Order completed, no refund'; END IF;
  IF v_order.status != 'Dibatalkan' THEN RAISE EXCEPTION 'Order not canceled'; END IF;
  IF v_order.is_refunded            THEN RAISE EXCEPTION 'Already refunded'; END IF;

  INSERT INTO wallets (user_id, balance) VALUES (v_order.user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance FROM wallets WHERE user_id = v_order.user_id FOR UPDATE;

  UPDATE wallets SET balance = balance + v_order.total_amount, updated_at = NOW()
  WHERE user_id = v_order.user_id;

  PERFORM create_transaction(
    v_order.user_id, p_order_id, 'refund', v_order.total_amount,
    'Refund for canceled order ' || p_order_id, NULL
  );

  UPDATE orders SET is_refunded = TRUE WHERE id = p_order_id;
  DELETE FROM pending_refunds WHERE order_id = p_order_id;

  PERFORM _write_audit_log(
    v_order.user_id, 'system', 'refund_order', p_order_id,
    jsonb_build_object(
      'total_amount', v_order.total_amount,
      'balance_before', v_balance,
      'balance_after', v_balance + v_order.total_amount
    )
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


CREATE OR REPLACE FUNCTION cancel_order(
  p_order_id UUID,
  p_actor    TEXT,
  p_reason   TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_order      orders%ROWTYPE;
  v_actor_role TEXT;
BEGIN
  PERFORM pg_try_advisory_xact_lock(hashtext(auth.uid()::text));

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF v_order.user_id != auth.uid() AND p_actor != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_order.status = 'Dibatalkan' THEN RAISE EXCEPTION 'Already canceled'; END IF;
  IF v_order.status = 'Selesai'    THEN RAISE EXCEPTION 'Cannot cancel completed order'; END IF;

  v_actor_role := CASE WHEN p_actor = 'admin' THEN 'admin' ELSE 'user' END;

  UPDATE orders
  SET status = 'Dibatalkan', canceled_by = p_actor,
      cancel_reason = p_reason, canceled_at = NOW()
  WHERE id = p_order_id;

  PERFORM _write_audit_log(
    auth.uid(), v_actor_role, 'cancel_order', p_order_id,
    jsonb_build_object(
      'reason', p_reason,
      'previous_status', v_order.status,
      'payment_status', v_order.payment_status
    )
  );

  IF v_order.payment_status = 'paid' AND v_order.is_refunded = FALSE THEN
    BEGIN
      PERFORM refund_order(p_order_id, TRUE);
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO pending_refunds (order_id, last_error)
      VALUES (p_order_id, SQLERRM)
      ON CONFLICT (order_id) DO UPDATE SET last_error = EXCLUDED.last_error;

      PERFORM _write_audit_log(
        auth.uid(), 'system', 'refund_queued', p_order_id,
        jsonb_build_object('error', SQLERRM)
      );
    END;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


CREATE OR REPLACE FUNCTION verify_hash_chain(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_row      transactions%ROWTYPE;
  v_expected TEXT;
  v_ok       BOOLEAN := TRUE;
BEGIN
  FOR v_row IN
    SELECT * FROM transactions WHERE user_id = p_user_id ORDER BY seq ASC
  LOOP
    v_expected := encode(
      digest(
        p_user_id::TEXT
        || COALESCE(v_row.order_id::TEXT, '')
        || v_row.type
        || v_row.amount::TEXT
        || v_row.prev_hash,
        'sha256'
      ), 'hex'
    );

    IF v_row.hash != v_expected THEN
      INSERT INTO audit_log (actor_id, actor_role, action, target_id, payload)
      VALUES (p_user_id, 'system', 'hash_chain_violation', v_row.id,
        jsonb_build_object('seq', v_row.seq, 'expected', v_expected, 'found', v_row.hash)
      );
      v_ok := FALSE;
    END IF;
  END LOOP;

  RETURN v_ok;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


CREATE OR REPLACE FUNCTION process_pending_refunds()
RETURNS VOID AS $$
DECLARE
  v_rec pending_refunds%ROWTYPE;
BEGIN
  FOR v_rec IN
    SELECT * FROM pending_refunds
    WHERE retry_after <= NOW() AND attempts < 5
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      PERFORM refund_order(v_rec.order_id, TRUE);
      DELETE FROM pending_refunds WHERE order_id = v_rec.order_id;
      PERFORM _write_audit_log(NULL, 'system', 'pending_refund_success', v_rec.order_id, NULL);
    EXCEPTION WHEN OTHERS THEN
      UPDATE pending_refunds
      SET attempts    = attempts + 1,
          last_error  = SQLERRM,
          retry_after = NOW() + (power(2, attempts + 1) * interval '1 minute')
      WHERE order_id = v_rec.order_id;
      PERFORM _write_audit_log(NULL, 'system', 'pending_refund_failed', v_rec.order_id,
        jsonb_build_object('attempt', v_rec.attempts + 1, 'error', SQLERRM)
      );
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


CREATE OR REPLACE FUNCTION check_balance_integrity(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_tx_sum  NUMERIC;
  v_balance NUMERIC;
  v_valid   BOOLEAN;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_tx_sum
  FROM transactions WHERE user_id = p_user_id;

  SELECT COALESCE(balance, 0) INTO v_balance
  FROM wallets WHERE user_id = p_user_id;

  v_valid := (v_tx_sum = v_balance);

  IF NOT v_valid THEN
    PERFORM _write_audit_log(
      p_user_id, 'system', 'balance_integrity_mismatch', p_user_id,
      jsonb_build_object(
        'transaction_sum', v_tx_sum,
        'wallet_balance',  v_balance,
        'variance',        v_tx_sum - v_balance
      )
    );
  END IF;

  RETURN json_build_object(
    'is_valid',        v_valid,
    'transaction_sum', v_tx_sum,
    'wallet_balance',  v_balance,
    'variance',        v_tx_sum - v_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- ────────────────────────────────────────────────────────────
-- SECTION 5: pg_cron SCHEDULES
-- ────────────────────────────────────────────────────────────

SELECT cron.schedule(
  'process_pending_refunds',
  '*/5 * * * *',
  $$ SELECT process_pending_refunds(); $$
);

-- [P2] Fix: nested dollar-quoting menggunakan $inner$ agar tidak konflik dengan $$ luar
SELECT cron.schedule(
  'verify_all_hash_chains',
  '0 * * * *',
  $outer$
    DO $inner$
    DECLARE r RECORD;
    BEGIN
      FOR r IN SELECT DISTINCT user_id FROM transactions LOOP
        PERFORM verify_hash_chain(r.user_id);
      END LOOP;
    END;
    $inner$;
  $outer$
);


-- ────────────────────────────────────────────────────────────
-- SECTION 6: TRIGGER — wallets.updated_at
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _update_wallet_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wallets_updated_at ON wallets;
CREATE TRIGGER trg_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION _update_wallet_timestamp();


-- ────────────────────────────────────────────────────────────
-- SECTION 7: ENGINE-LEVEL IMMUTABILITY RULES
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE RULE transactions_no_update AS
  ON UPDATE TO transactions DO INSTEAD NOTHING;

CREATE OR REPLACE RULE transactions_no_delete AS
  ON DELETE TO transactions DO INSTEAD NOTHING;

CREATE OR REPLACE RULE audit_log_no_update AS
  ON UPDATE TO audit_log DO INSTEAD NOTHING;

CREATE OR REPLACE RULE audit_log_no_delete AS
  ON DELETE TO audit_log DO INSTEAD NOTHING;


-- ============================================================
-- MIGRATION v2 PATCHED — COMPLETE
-- ============================================================