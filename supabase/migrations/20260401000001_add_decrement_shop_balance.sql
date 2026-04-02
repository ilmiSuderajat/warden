-- Migration: Add atomic decrement_shop_balance function
-- Date: 2026-04-01

CREATE OR REPLACE FUNCTION public.decrement_shop_balance(p_shop_id UUID, p_amount NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
    v_new_balance NUMERIC;
BEGIN
    -- Atomic update with balance check
    UPDATE public.shops
    SET balance = balance - p_amount
    WHERE id = p_shop_id AND balance >= p_amount
    RETURNING balance INTO v_new_balance;

    -- If no row updated, it means shop missing or balance insufficient
    IF v_new_balance IS NULL THEN
        RAISE EXCEPTION 'Saldo tidak mencukupi atau toko tidak ditemukan';
    END IF;

    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
