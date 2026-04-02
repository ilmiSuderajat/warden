-- Enable pgcrypto for SHA256 if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create Wallets Table
CREATE TABLE IF NOT EXISTS public.wallets (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    balance BIGINT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for Wallets
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own wallet" ON public.wallets
    FOR SELECT USING (auth.uid() = user_id);

-- 2. Create Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('payment', 'refund', 'topup', 'commission')),
    amount BIGINT NOT NULL,
    description TEXT,
    prev_hash TEXT NOT NULL,
    hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_order_type UNIQUE (order_id, type)
);

-- RLS for Transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own transactions" ON public.transactions
    FOR SELECT USING (auth.uid() = user_id);

-- 3. Update orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS canceled_by TEXT,
ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_refunded BOOLEAN DEFAULT FALSE;

-- 4. RPC Functions

-- A. Create Wallet Transaction Logging (Internal)
CREATE OR REPLACE FUNCTION public.create_wallet_transaction(
    p_user_id UUID,
    p_order_id UUID,
    p_type TEXT,
    p_amount BIGINT,
    p_desc TEXT
) RETURNS UUID AS $$
DECLARE
    v_prev_hash TEXT;
    v_new_hash TEXT;
    v_transaction_id UUID;
BEGIN
    -- Get last hash for user
    SELECT hash INTO v_prev_hash
    FROM public.transactions
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_prev_hash IS NULL THEN
        v_prev_hash := 'GENESIS';
    END IF;

    -- Hash generation: SHA256(user_id + order_id + type + amount + prev_hash)
    -- Using COALESCE for order_id just in case it's null (like topup)
    v_new_hash := encode(digest(
        p_user_id::TEXT || COALESCE(p_order_id::TEXT, '') || p_type || p_amount::TEXT || v_prev_hash,
        'sha256'
    ), 'hex');

    INSERT INTO public.transactions (user_id, order_id, type, amount, description, prev_hash, hash, created_at)
    VALUES (p_user_id, p_order_id, p_type, p_amount, p_desc, v_prev_hash, v_new_hash, NOW())
    RETURNING id INTO v_transaction_id;

    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- B. Process Payment
CREATE OR REPLACE FUNCTION public.process_wallet_payment(p_order_id UUID) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_total_amount BIGINT;
    v_balance BIGINT;
    v_status TEXT;
BEGIN
    -- Lock order row
    SELECT user_id, total_amount, status INTO v_user_id, v_total_amount, v_status
    FROM public.orders WHERE id = p_order_id FOR UPDATE;

    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Order tidak ditemukan'; END IF;
    IF v_status != 'Dibuat' AND v_status != 'Menunggu Pembayaran' THEN
        RAISE EXCEPTION 'Order tidak dalam status yang bisa dibayar (Status saat ini: %)', v_status;
    END IF;

    -- Lock wallet for update to prevent race conditions
    SELECT balance INTO v_balance FROM public.wallets WHERE user_id = v_user_id FOR UPDATE;
    IF v_balance IS NULL THEN RAISE EXCEPTION 'Wallet tidak ditemukan'; END IF;
    IF v_balance < v_total_amount THEN RAISE EXCEPTION 'Saldo tidak mencukupi (Saldo: %, Total: %)', v_balance, v_total_amount; END IF;

    -- Deduct balance
    UPDATE public.wallets SET balance = balance - v_total_amount WHERE user_id = v_user_id;

    -- Insert standard transaction
    PERFORM public.create_wallet_transaction(
        v_user_id,
        p_order_id,
        'payment',
        -v_total_amount,
        'Pembayaran menggunakan saldo Wallet untuk pesanan #' || substr(p_order_id::TEXT, 1, 8)
    );

    -- Update order status
    UPDATE public.orders SET status = 'Mencari Kurir', payment_status = 'paid', payment_method = 'wallet' WHERE id = p_order_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- C. Refund Order
CREATE OR REPLACE FUNCTION public.refund_order(p_order_id UUID) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_total_amount BIGINT;
    v_status TEXT;
    v_is_refunded BOOLEAN;
    v_payment_status TEXT;
BEGIN
    -- Lock order row
    SELECT user_id, total_amount, status, is_refunded, payment_status INTO v_user_id, v_total_amount, v_status, v_is_refunded, v_payment_status
    FROM public.orders WHERE id = p_order_id FOR UPDATE;

    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Order tidak ditemukan'; END IF;
    IF v_status != 'Dibatalkan' THEN RAISE EXCEPTION 'Order belum dibatalkan. Refund ditolak. (Status saat ini: %)', v_status; END IF;
    IF v_is_refunded = TRUE THEN RAISE EXCEPTION 'Refund ganda terdeteksi (is_refunded = true).'; END IF;
    IF v_payment_status != 'paid' THEN RAISE EXCEPTION 'Order belum dibayar. Tidak ada yang perlu direfund.'; END IF;

    -- Lock wallet for update
    PERFORM 1 FROM public.wallets WHERE user_id = v_user_id FOR UPDATE;

    -- Refund balance
    UPDATE public.wallets SET balance = balance + v_total_amount WHERE user_id = v_user_id;

    -- Insert refund transaction
    PERFORM public.create_wallet_transaction(
        v_user_id,
        p_order_id,
        'refund',
        v_total_amount,
        'Refund pembatalan pesanan #' || substr(p_order_id::TEXT, 1, 8)
    );

    -- Mark as refunded
    UPDATE public.orders SET is_refunded = TRUE WHERE id = p_order_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- D. Cancel Order
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id UUID, p_actor TEXT, p_reason TEXT) RETURNS BOOLEAN AS $$
DECLARE
    v_status TEXT;
    v_payment_method TEXT;
    v_payment_status TEXT;
    v_is_refunded BOOLEAN;
BEGIN
    -- Lock order row
    SELECT status, payment_method, payment_status, is_refunded INTO v_status, v_payment_method, v_payment_status, v_is_refunded
    FROM public.orders WHERE id = p_order_id FOR UPDATE;

    -- Strict Order Status Validation
    -- Hanya bisa dibatalkan jika Dibuat, Menunggu Pembayaran, Mencari Kurir, atau Kurir Menuju Toko (accepted). 
    -- Tambahan validasi: Jika driver sudah tiba ('arrived_at_store', 'picked_up', dsb) tolak.
    IF v_status IN ('Selesai', 'Dikirim', 'Kurir di Lokasi', 'Dibatalkan') THEN
        RAISE EXCEPTION 'Order tidak dapat dibatalkan pada status saat ini: %', v_status;
    END IF;

    -- Apply changes
    UPDATE public.orders SET
        status = 'Dibatalkan',
        canceled_by = p_actor,
        cancel_reason = p_reason,
        canceled_at = NOW()
    WHERE id = p_order_id;

    -- Auto-refund logic (Only if paid by wallet and not yet refunded)
    IF v_payment_method = 'wallet' AND v_payment_status = 'paid' AND v_is_refunded = FALSE THEN
        PERFORM public.refund_order(p_order_id);
    END IF;

    -- Expire matching unconfirmed/waiting driver assignments
    UPDATE public.driver_orders SET status = 'expired' WHERE order_id = p_order_id AND status IN ('offered', 'accepted');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
