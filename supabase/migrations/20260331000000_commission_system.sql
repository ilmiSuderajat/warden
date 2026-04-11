-- Migration 1: distribute_commission
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_commission_distributed BOOLEAN DEFAULT FALSE;

-- Fix uniqueness constraint back-port: allow same order to have commissions for different users (shop/driver)
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS no_duplicate_tx;
ALTER TABLE public.transactions ADD CONSTRAINT no_duplicate_tx UNIQUE (user_id, order_id, type);

CREATE OR REPLACE FUNCTION public.distribute_commission(p_order_id UUID)
RETURNS void AS $$
DECLARE
    v_order RECORD;
    v_shop_user_id UUID;
    v_driver_user_id UUID;
    v_total_amount NUMERIC;
    v_shipping_amount NUMERIC;
    v_shop_earning NUMERIC;
    v_shop_id UUID;
    v_product_name TEXT;
BEGIN
    -- 1. Lock order FOR UPDATE
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order tidak ditemukan';
    END IF;

    -- 2. Validate status = Selesai
    IF v_order.status != 'Selesai' THEN
        RAISE EXCEPTION 'Order status harus Selesai. Status saat ini: %', v_order.status;
    END IF;

    -- 3. Validate belum pernah didistribusi
    IF v_order.is_commission_distributed THEN
        RAISE EXCEPTION 'Komisi untuk order ini sudah didistribusikan';
    END IF;

    -- 4. Ambil informasi dari order
    v_total_amount := coalesce(v_order.total_amount, 0);
    v_shipping_amount := coalesce(v_order.shipping_amount, 0);
    v_driver_user_id := v_order.driver_id;

    -- Ambil shop_id dari order_items (product_name split)
    SELECT product_name INTO v_product_name
    FROM public.order_items
    WHERE order_id = p_order_id
    LIMIT 1;

    IF v_product_name IS NULL THEN
        RAISE EXCEPTION 'Order tidak memiliki item';
    END IF;

    -- Extract shop_id from "Nama Produk | {uuid}"
    BEGIN
        v_shop_id := split_part(v_product_name, ' | ', 2)::UUID;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Gagal mengambil Shop ID dari produk: %', v_product_name;
    END;

    -- Dapatkan owner_id dari shop
    SELECT owner_id INTO v_shop_user_id
    FROM public.shops
    WHERE id = v_shop_id;

    IF v_shop_user_id IS NULL THEN
        RAISE EXCEPTION 'Toko untuk order ini tidak ditemukan atau tidak memiliki owner';
    END IF;

    -- 5. Hitung shop_earning dan potongan platform
    v_shop_earning := FLOOR((v_total_amount - v_shipping_amount) * 0.95); -- Merchant dipotong 5%
    v_shipping_amount := FLOOR(v_shipping_amount * 0.80); -- Driver dipotong 20%

    -- 6. ATOMIC dalam satu transaksi
    -- a. Credit wallets[shop_user_id]
    IF v_shop_earning > 0 THEN
        UPDATE public.wallets
        SET balance = balance + v_shop_earning,
            updated_at = NOW()
        WHERE user_id = v_shop_user_id;

        PERFORM public.create_transaction(
            v_shop_user_id,
            p_order_id,
            'commission',
            v_shop_earning,
            'Hasil penjualan order #' || substr(p_order_id::text, 1, 8),
            'sys-comm-shop-' || p_order_id::text
        );

        INSERT INTO public.audit_log (actor_id, actor_role, action, target_id, payload)
        VALUES (v_shop_user_id, 'shop', 'distribute_commission_shop', p_order_id, jsonb_build_object('amount', v_shop_earning, 'shop_id', v_shop_id));
    END IF;

    -- b. Credit wallets[driver_user_id]
    IF v_driver_user_id IS NOT NULL AND v_shipping_amount > 0 THEN
        UPDATE public.wallets
        SET balance = balance + v_shipping_amount,
            updated_at = NOW()
        WHERE user_id = v_driver_user_id;

        PERFORM public.create_transaction(
            v_driver_user_id,
            p_order_id,
            'commission',
            v_shipping_amount,
            'Komisi ongkir order #' || substr(p_order_id::text, 1, 8),
            'sys-comm-drv-' || p_order_id::text
        );

        INSERT INTO public.audit_log (actor_id, actor_role, action, target_id, payload)
        VALUES (v_driver_user_id, 'driver', 'distribute_commission_driver', p_order_id, jsonb_build_object('amount', v_shipping_amount, 'driver_id', v_driver_user_id));
    END IF;

    -- c. UPDATE orders SET is_commission_distributed = TRUE
    UPDATE public.orders
    SET is_commission_distributed = TRUE
    WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
