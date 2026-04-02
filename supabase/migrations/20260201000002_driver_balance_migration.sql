-- ==========================================
-- MIGRATION: DRIVER BALANCE SYSTEM
-- ==========================================

-- 1. Create table for Driver Balance Logs
CREATE TABLE IF NOT EXISTS driver_balance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'commission_online', 'commission_cod_debit', 'topup', 'withdraw', 'refund'
    amount NUMERIC NOT NULL,
    balance_after NUMERIC NOT NULL,
    description TEXT,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create table for Driver Topup Requests (Midtrans)
CREATE TABLE IF NOT EXISTS driver_topup_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    midtrans_order_id VARCHAR(255) UNIQUE,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'paid', 'cancelled', 'expired'
    snap_token VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create table for Driver Withdraw Requests
CREATE TABLE IF NOT EXISTS driver_withdraw_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    bank_name VARCHAR(100),
    account_number VARCHAR(100),
    account_name VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_driver_balance_logs_driver_id ON driver_balance_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_topup_requests_driver_id ON driver_topup_requests(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_withdraw_requests_driver_id ON driver_withdraw_requests(driver_id);

-- RLS (Row Level Security) Policies
ALTER TABLE driver_balance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_topup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_withdraw_requests ENABLE ROW LEVEL SECURITY;

-- Driver Balance Logs: Driver can view own logs
DROP POLICY IF EXISTS "Driver can view own logs" ON driver_balance_logs;
CREATE POLICY "Driver can view own logs" ON driver_balance_logs
    FOR SELECT USING (auth.uid() = driver_id);

-- Driver Topup Requests: Driver can view and insert own requests
DROP POLICY IF EXISTS "Driver can view own topup requests" ON driver_topup_requests;
CREATE POLICY "Driver can view own topup requests" ON driver_topup_requests
    FOR SELECT USING (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Driver can create own topup requests" ON driver_topup_requests;
CREATE POLICY "Driver can create own topup requests" ON driver_topup_requests
    FOR INSERT WITH CHECK (auth.uid() = driver_id);

-- Driver Withdraw Requests: Driver can view and insert own requests
DROP POLICY IF EXISTS "Driver can view own withdraw requests" ON driver_withdraw_requests;
CREATE POLICY "Driver can view own withdraw requests" ON driver_withdraw_requests
    FOR SELECT USING (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Driver can insert own withdraw requests" ON driver_withdraw_requests;
CREATE POLICY "Driver can insert own withdraw requests" ON driver_withdraw_requests
    FOR INSERT WITH CHECK (auth.uid() = driver_id);

SELECT 'Migration for Driver Balance created successfully' as status;
