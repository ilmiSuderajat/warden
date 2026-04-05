-- Function to atomically increment wallet points
CREATE OR REPLACE FUNCTION increment_wallet_points(p_user_id UUID, p_amount INTEGER)
RETURNS void AS $$
BEGIN
    UPDATE public.wallets
    SET points_balance = points_balance + p_amount
    WHERE user_id = p_user_id;

    -- Create wallet if it doesn't exist (safety)
    IF NOT FOUND THEN
        INSERT INTO public.wallets (user_id, balance, points_balance)
        VALUES (p_user_id, 0, p_amount);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to exchange points for wallet balance
CREATE OR REPLACE FUNCTION exchange_points_to_balance(p_user_id UUID, p_points_to_exchange INTEGER, p_conversion_rate INTEGER DEFAULT 1)
RETURNS json AS $$
DECLARE
    v_current_points INTEGER;
    v_balance_to_add INTEGER;
BEGIN
    -- Check current points
    SELECT points_balance INTO v_current_points
    FROM public.wallets
    WHERE user_id = p_user_id;

    IF v_current_points IS NULL OR v_current_points < p_points_to_exchange THEN
        RETURN json_build_object('success', false, 'error', 'Poin tidak mencukupi');
    END IF;

    v_balance_to_add := p_points_to_exchange * p_conversion_rate;

    -- Update wallet
    UPDATE public.wallets
    SET points_balance = points_balance - p_points_to_exchange,
        balance = balance + v_balance_to_add
    WHERE user_id = p_user_id;

    -- Log transaction (assuming a wallet_transactions table exists)
    -- This part depends on the existing schema, but for now we focus on the wallet update.

    RETURN json_build_object('success', true, 'balance_added', v_balance_to_add);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
