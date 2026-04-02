-- Create function to check pending refunds and alert
DROP FUNCTION IF EXISTS public.check_pending_refunds_and_alert();
CREATE OR REPLACE FUNCTION public.check_pending_refunds_and_alert()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT order_id, attempts, last_error 
        FROM public.pending_refunds 
        WHERE attempts >= 3
    LOOP
        INSERT INTO public.audit_log (actor_role, action, payload)
        VALUES (
            'system',
            'pending_refund_warning',
            jsonb_build_object(
                'order_id', r.order_id,
                'attempts', r.attempts,
                'last_error', r.last_error
            )
        );
    END LOOP;
END;
$$;

-- Create function for admin monitoring stats
DROP FUNCTION IF EXISTS public.get_admin_stats();
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
    v_total_wallets bigint;
    v_mismatch_count bigint := 0;
    v_pending_count bigint;
    v_pending_critical bigint;
    v_last_violation json;
    r record;
BEGIN
    SELECT count(*) INTO v_total_wallets FROM public.wallets;
    
    -- Count mismatches by verifying each wallet integrity
    FOR r IN SELECT user_id FROM public.wallets LOOP
        IF (public.check_balance_integrity(r.user_id)->>'is_valid')::boolean = false THEN
            v_mismatch_count := v_mismatch_count + 1;
        END IF;
    END LOOP;

    SELECT count(*) INTO v_pending_count FROM public.pending_refunds;
    SELECT count(*) INTO v_pending_critical FROM public.pending_refunds WHERE attempts >= 3;
    
    SELECT row_to_json(al) INTO v_last_violation
    FROM (
        SELECT * FROM public.audit_log 
        WHERE action = 'hash_chain_violation' 
        ORDER BY created_at DESC LIMIT 1
    ) al;

    SELECT json_build_object(
        'total_wallets', v_total_wallets,
        'mismatch_count', v_mismatch_count,
        'pending_refunds_count', v_pending_count,
        'pending_refunds_critical', v_pending_critical,
        'last_hash_violation', v_last_violation
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Schedule job using pg_cron to run every 30 minutes
SELECT cron.schedule(
    'check-pending-refunds-alert-job',
    '*/30 * * * *',
    $$ SELECT public.check_pending_refunds_and_alert(); $$
);
