DO $$AA
DECLARE
  v_user_id UUID := gen_random_uuid();
    v_order_id UUID := gen_random_uuid();
    BEGIN
      INSERT INTO users (id, email, full_name) VALUES (v_user_id, 'test-monitor@local.io', 'Monitor Test');
        INSERT INTO wallets (user_id, balance) VALUES (v_user_id, 1000000);
          INSERT INTO orders (id, user_id, customer_name, whatsapp_number, address, total_amount, payment_method)
            VALUES (v_order_id, v_user_id, 'Monitor Test', '08123', 'Address', 50000, 'wallet');
              INSERT INTO pending_refunds (order_id, attempts, last_error)
                VALUES (v_order_id, 3, 'mock critical error');
                  PERFORM alert_critical_pending_refunds();
                  END $$;
