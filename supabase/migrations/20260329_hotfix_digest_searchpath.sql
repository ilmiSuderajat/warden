-- ============================================================
-- HOTFIX: Fix digest() search_path for Supabase Cloud
-- On Supabase Cloud, pgcrypto lives in the 'extensions' schema.
-- Functions with SET search_path = public can't find digest().
-- Fix: add 'extensions' to the search_path for affected functions.
-- ============================================================

-- Ensure pgcrypto is installed
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- Fix create_transaction: add extensions to search_path
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
    extensions.digest(
      p_user_id::TEXT
      || COALESCE(p_order_id::TEXT, '')
      || p_type::TEXT
      || p_amount::TEXT
      || v_prev_hash::TEXT,
      'sha256'::TEXT
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


-- Fix verify_hash_chain: same search_path fix
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
      extensions.digest(
        p_user_id::TEXT
        || COALESCE(v_row.order_id::TEXT, '')
        || v_row.type::TEXT
        || v_row.amount::TEXT
        || v_row.prev_hash::TEXT,
        'sha256'::TEXT
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


-- ============================================================
-- HOTFIX COMPLETE
-- ============================================================
