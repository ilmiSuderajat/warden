-- Migration: Add atomic decrement_saldo function
-- Date: 2026-04-01

CREATE OR REPLACE FUNCTION public.decrement_saldo(p_user_id UUID, p_amount NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
    v_new_saldo NUMERIC;
BEGIN
    -- Atomic update with balance check
    UPDATE public.users
    SET saldo = saldo - p_amount
    WHERE id = p_user_id AND saldo >= p_amount
    RETURNING saldo INTO v_new_saldo;

    -- If no row updated, it means user missing or balance insufficient
    IF v_new_saldo IS NULL THEN
        RAISE EXCEPTION 'Saldo tidak mencukupi atau user tidak ditemukan';
    END IF;

    RETURN v_new_saldo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
