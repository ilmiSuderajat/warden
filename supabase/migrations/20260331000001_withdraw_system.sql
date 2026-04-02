-- Migration 2: withdraw system
CREATE TABLE IF NOT EXISTS public.withdraw_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    amount NUMERIC NOT NULL CHECK (amount > 0),
    bank_name TEXT NOT NULL,
    bank_account TEXT NOT NULL,
    bank_holder TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending','approved','rejected')) DEFAULT 'pending',
    reject_reason TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    processed_by UUID
);

-- RLS
ALTER TABLE public.withdraw_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own withdraw requests" 
    ON public.withdraw_requests 
    FOR SELECT 
    USING (auth.uid() = user_id);

-- RPC: request_withdraw
CREATE OR REPLACE FUNCTION public.request_withdraw(
    p_amount NUMERIC,
    p_bank_name TEXT,
    p_bank_account TEXT,
    p_bank_holder TEXT
) RETURNS UUID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_wallet RECORD;
    v_request_id UUID;
    v_idempotency TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 1. Advisory lock (hash user_id)
    PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text));

    -- 2. Validate amount
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be greater than 0';
    END IF;

    -- 3. Lock wallet FOR UPDATE
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found';
    END IF;

    -- 4. Validate balance
    IF v_wallet.balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    -- 5. Deduct balance
    UPDATE public.wallets
    SET balance = balance - p_amount,
        updated_at = NOW()
    WHERE user_id = v_user_id;

    -- 6. create_transaction
    v_idempotency := 'withdraw-req-' || gen_random_uuid()::text;
    PERFORM public.create_transaction(
        v_user_id,
        NULL,
        'withdraw',
        -p_amount,
        'Withdrawal request to ' || p_bank_name || ' (' || p_bank_account || ')',
        v_idempotency
    );

    -- 7. INSERT INTO withdraw_requests
    INSERT INTO public.withdraw_requests (
        user_id, amount, bank_name, bank_account, bank_holder
    ) VALUES (
        v_user_id, p_amount, p_bank_name, p_bank_account, p_bank_holder
    ) RETURNING id INTO v_request_id;

    -- 8. Write audit_log
    INSERT INTO public.audit_log (actor_id, actor_role, action, target_id, payload)
    VALUES (v_user_id, 'user', 'request_withdraw', v_request_id, jsonb_build_object('amount', p_amount));

    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC: approve_withdraw
CREATE OR REPLACE FUNCTION public.approve_withdraw(p_request_id UUID)
RETURNS void AS $$
DECLARE
    v_request RECORD;
BEGIN
    -- 1. Lock request FOR UPDATE
    SELECT * INTO v_request
    FROM public.withdraw_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found';
    END IF;

    -- 2. Validate status
    IF v_request.status != 'pending' THEN
        RAISE EXCEPTION 'Request status is not pending';
    END IF;

    -- 3. UPDATE status
    UPDATE public.withdraw_requests
    SET status = 'approved',
        processed_at = NOW(),
        processed_by = auth.uid()
    WHERE id = p_request_id;

    -- 4. audit log
    INSERT INTO public.audit_log (actor_id, actor_role, action, target_id, payload)
    VALUES (auth.uid(), 'admin', 'approve_withdraw', p_request_id, '{}'::jsonb);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC: reject_withdraw
CREATE OR REPLACE FUNCTION public.reject_withdraw(p_request_id UUID, p_reason TEXT)
RETURNS void AS $$
DECLARE
    v_request RECORD;
    v_idempotency TEXT;
BEGIN
    -- 1. Lock request FOR UPDATE
    SELECT * INTO v_request
    FROM public.withdraw_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found';
    END IF;

    -- 2. Validate status
    IF v_request.status != 'pending' THEN
        RAISE EXCEPTION 'Request status is not pending';
    END IF;

    -- 3. Amount
    
    -- 4. Kembalikan saldo
    UPDATE public.wallets
    SET balance = balance + v_request.amount,
        updated_at = NOW()
    WHERE user_id = v_request.user_id;

    -- 5. create_transaction
    v_idempotency := 'withdraw-rej-' || p_request_id::text;
    PERFORM public.create_transaction(
        v_request.user_id,
        NULL,
        'topup',
        v_request.amount,
        'Refund withdraw rejected: ' || p_reason,
        v_idempotency
    );

    -- 6. UPDATE status
    UPDATE public.withdraw_requests
    SET status = 'rejected',
        reject_reason = p_reason,
        processed_at = NOW(),
        processed_by = auth.uid()
    WHERE id = p_request_id;

    -- 7. Write audit_log
    INSERT INTO public.audit_log (actor_id, actor_role, action, target_id, payload)
    VALUES (auth.uid(), 'admin', 'reject_withdraw', p_request_id, jsonb_build_object('reason', p_reason));

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
