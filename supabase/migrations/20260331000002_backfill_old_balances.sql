-- Migration 3: backfill data lama

-- 1. Backfill shop_balance_logs
DO $$
DECLARE
    v_log RECORD;
    v_user_id UUID;
    v_type TEXT;
    v_idempotency TEXT;
BEGIN
    FOR v_log IN SELECT * FROM public.shop_balance_logs
    LOOP
        -- Dapatkan owner_id user dari shop_id
        SELECT owner_id INTO v_user_id
        FROM public.shops
        WHERE id = v_log.shop_id;

        IF v_user_id IS NOT NULL THEN
            IF v_log.amount >= 0 THEN
                v_type := 'commission';
            ELSE
                v_type := 'withdraw';
            END IF;

            v_idempotency := 'backfill-shop-' || v_log.id::text;

            -- Use RPC to ensure proper hash generation and ledger integrity
            PERFORM public.create_transaction(
                v_user_id,
                v_log.order_id,
                v_type,
                v_log.amount,
                v_log.description,
                v_idempotency
            );
        END IF;
    END LOOP;
END;
$$;


-- 2. Backfill driver_balance_logs
DO $$
DECLARE
    v_log RECORD;
    v_type TEXT;
    v_idempotency TEXT;
BEGIN
    FOR v_log IN SELECT * FROM public.driver_balance_logs
    LOOP
        IF v_log.amount >= 0 THEN
            v_type := 'commission';
        ELSE
            v_type := 'withdraw';
        END IF;

        v_idempotency := 'backfill-driver-' || v_log.id::text;

        -- Use RPC to ensure proper hash generation and ledger integrity
        PERFORM public.create_transaction(
            v_log.driver_id,
            v_log.order_id,
            v_type,
            v_log.amount,
            v_log.description,
            v_idempotency
        );
    END LOOP;
END;
$$;
