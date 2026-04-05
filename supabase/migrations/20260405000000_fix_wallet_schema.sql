-- ============================================================
-- MIGRATION: Fix Wallet Schema & Add User Topup Support
-- Date: 2026-04-05
-- ============================================================

-- 1. Add points_balance to wallets table
ALTER TABLE public.wallets 
ADD COLUMN IF NOT EXISTS points_balance NUMERIC DEFAULT 0;

-- 2. Create user_topup_requests table for Midtrans integration
CREATE TABLE IF NOT EXISTS public.user_topup_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    midtrans_order_id TEXT UNIQUE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    snap_token TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS for user_topup_requests
ALTER TABLE public.user_topup_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view and create own topup requests" ON public.user_topup_requests;
CREATE POLICY "Users can view and create own topup requests" ON public.user_topup_requests
    FOR ALL USING (auth.uid() = user_id);

-- 4. Ensure transactions table has seq and balance_after (re-verifying)
-- Note: These columns should already exist if the patched migration was run, 
-- but this is a safety check.
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='seq') THEN
        ALTER TABLE public.transactions ADD COLUMN seq BIGSERIAL UNIQUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='balance_after') THEN
        ALTER TABLE public.transactions ADD COLUMN balance_after NUMERIC;
    END IF;
END $$;

-- Reload schema for PostgREST
NOTIFY pgrst, 'reload schema';
