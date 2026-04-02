CREATE OR REPLACE FUNCTION topup_wallet(
  p_amount NUMERIC,
  p_note   TEXT DEFAULT NULL   -- dummy, diabaikan oleh logic
)
RETURNS BOOLEAN AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  PERFORM pg_try_advisory_xact_lock(hashtext(auth.uid()::text));
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Topup amount must be greater than 0'; END IF;
  
  INSERT INTO wallets (user_id, balance) VALUES (auth.uid(), 0) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO v_balance FROM wallets WHERE user_id = auth.uid() FOR UPDATE;
  UPDATE wallets SET balance = balance + p_amount, updated_at = NOW() WHERE user_id = auth.uid();
  
  PERFORM create_transaction(auth.uid(), NULL, 'topup', p_amount, 'Wallet topup', NULL);
  PERFORM _write_audit_log(auth.uid(), 'user', 'topup_wallet', NULL, jsonb_build_object('amount', p_amount, 'balance_before', v_balance, 'balance_after', v_balance + p_amount));
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- Force PostgREST to reload schema AFTER this function is committed,
-- so it appears in the schema cache on the very next RPC call.
NOTIFY pgrst, 'reload schema';
