-- Function for Auto-canceling unpaid orders after 10 minutes
DROP FUNCTION IF EXISTS public.cancel_expired_orders();
CREATE OR REPLACE FUNCTION public.cancel_expired_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.orders
    SET 
        status = 'Dibatalkan',
        cancel_reason = 'Dibatalkan otomatis karena waktu pembayaran habis (10 menit)',
        canceled_at = NOW()
    WHERE 
        (status = 'Menunggu Pembayaran' OR payment_status = 'pending')
        AND created_at < NOW() - INTERVAL '10 minutes';
END;
$$;

-- Schedule job using pg_cron to run every minute
SELECT cron.schedule(
    'cancel-expired-unpaid-orders-job',
    '* * * * *',
    $$ SELECT public.cancel_expired_orders(); $$
);
