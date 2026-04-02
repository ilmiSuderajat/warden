-- ============================================================
-- Migration: Payment Security Hardening
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. Kolom untuk menyimpan Midtrans order ID (enables reliable status polling)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS midtrans_order_id TEXT;

-- Index untuk resolveOrderId() di webhook
CREATE INDEX IF NOT EXISTS idx_orders_midtrans_order_id
  ON orders (midtrans_order_id)
  WHERE midtrans_order_id IS NOT NULL;

-- 2. Kolom paid_at — timestamp saat pembayaran settle
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- 3. Kolom failed_reason — alasan kegagalan (opsional, untuk audit)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS failed_reason TEXT;

-- ============================================================
-- Update ENUM payment_status yang lebih lengkap
-- Jika payment_status masih TEXT, cukup jalankan bagian ini.
-- Jika sudah pakai ENUM, tambahkan nilai baru:
-- ============================================================
-- ALTER TYPE payment_status_enum ADD VALUE IF NOT EXISTS 'waiting_payment';
-- ALTER TYPE payment_status_enum ADD VALUE IF NOT EXISTS 'failed';
-- ALTER TYPE payment_status_enum ADD VALUE IF NOT EXISTS 'expired';

-- ============================================================
-- Status yang valid sekarang:
--   pending          → Order dibuat, belum diproses
--   waiting_payment  → Snap token dibuat, menunggu user bayar (lock)
--   processing       → COD dikonfirmasi, mencari kurir
--   paid             → Pembayaran online settlement
--   failed           → Midtrans deny / fraud
--   expired          → Midtrans expire
--   cancelled        → Dibatalkan user / cancel
-- ============================================================

-- Verifikasi kolom berhasil ditambahkan:
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name IN ('midtrans_order_id', 'paid_at', 'failed_reason');
