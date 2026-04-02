-- ============================================================
-- MIGRATION: Shop Balance, COD & Withdraw System
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. Tambah kolom ke tabel shops
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cod_enabled BOOLEAN DEFAULT TRUE;

-- 2. Tabel log aktivitas saldo warung
CREATE TABLE IF NOT EXISTS shop_balance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('commission', 'cod_debit', 'topup', 'withdraw')),
  amount NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  description TEXT,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabel request topup via Midtrans
CREATE TABLE IF NOT EXISTS shop_topup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  midtrans_order_id TEXT UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  snap_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabel request withdraw
CREATE TABLE IF NOT EXISTS shop_withdraw_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  bank_name TEXT,
  account_number TEXT,
  account_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Index untuk query efisien
CREATE INDEX IF NOT EXISTS idx_shop_balance_logs_shop_id ON shop_balance_logs(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_balance_logs_created_at ON shop_balance_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_topup_requests_shop_id ON shop_topup_requests(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_topup_requests_midtrans ON shop_topup_requests(midtrans_order_id);
CREATE INDEX IF NOT EXISTS idx_shop_withdraw_requests_shop_id ON shop_withdraw_requests(shop_id);

-- 6. RLS policies (asumsikan RLS aktif di Supabase)
-- shop_balance_logs: owner bisa lihat log miliknya
ALTER TABLE shop_balance_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner can view own logs" ON shop_balance_logs;
CREATE POLICY "Owner can view own logs" ON shop_balance_logs
  FOR SELECT USING (
    shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())
  );

-- shop_topup_requests: owner bisa lihat dan insert miliknya
ALTER TABLE shop_topup_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner can manage own topup" ON shop_topup_requests;
CREATE POLICY "Owner can manage own topup" ON shop_topup_requests
  FOR SELECT USING (
    shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())
  );

-- shop_withdraw_requests: owner bisa lihat dan insert miliknya
ALTER TABLE shop_withdraw_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner can manage own withdraw" ON shop_withdraw_requests;
CREATE POLICY "Owner can manage own withdraw" ON shop_withdraw_requests
  FOR SELECT USING (
    shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid())
  );
INSERT INTO shop_withdraw_requests SELECT * FROM shop_withdraw_requests WHERE FALSE; -- dummy

-- ============================================================
-- SELESAI - Jalankan semua di atas sekaligus
-- ============================================================
