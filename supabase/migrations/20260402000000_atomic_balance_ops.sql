-- Migration: Add atomic balance operations for User, Driver, and Shop
-- Date: 2026-04-02

-- 1. USER: increment_wallet_balance
CREATE OR REPLACE FUNCTION public.increment_wallet_balance(p_user_id UUID, p_amount NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
    v_new_balance NUMERIC;
BEGIN
    INSERT INTO public.wallets (user_id, balance) 
    VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.wallets
    SET balance = balance + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_balance;

    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. USER: decrement_wallet_balance
CREATE OR REPLACE FUNCTION public.decrement_wallet_balance(p_user_id UUID, p_amount NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
    v_new_balance NUMERIC;
BEGIN
    UPDATE public.wallets
    SET balance = balance - p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id AND balance >= p_amount
    RETURNING balance INTO v_new_balance;

    IF v_new_balance IS NULL THEN
        RAISE EXCEPTION 'Saldo tidak mencukupi atau wallet tidak ditemukan';
    END IF;

    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. DRIVER: increment_saldo (Driver saldo is in users table)
CREATE OR REPLACE FUNCTION public.increment_saldo(p_user_id UUID, p_amount NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
    v_new_saldo NUMERIC;
BEGIN
    UPDATE public.users
    SET saldo = COALESCE(saldo, 0) + p_amount
    WHERE id = p_user_id
    RETURNING saldo INTO v_new_saldo;

    IF v_new_saldo IS NULL THEN
        RAISE EXCEPTION 'User tidak ditemukan';
    END IF;

    RETURN v_new_saldo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. SHOP: increment_shop_balance
CREATE OR REPLACE FUNCTION public.increment_shop_balance(p_shop_id UUID, p_amount NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
    v_new_balance NUMERIC;
BEGIN
    UPDATE public.shops
    SET balance = COALESCE(balance, 0) + p_amount
    WHERE id = p_shop_id
    RETURNING balance INTO v_new_balance;

    IF v_new_balance IS NULL THEN
        RAISE EXCEPTION 'Warung tidak ditemukan';
    END IF;

    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify pgrst to reload schema
NOTIFY pgrst, 'reload schema';
