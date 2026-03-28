-- ============================================================
-- Migration: Product Reviews — Nama & Foto Ulasan
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. Tambah kolom nama reviewer (dari tabel addresses)
ALTER TABLE product_reviews
  ADD COLUMN IF NOT EXISTS reviewer_name TEXT;

-- 2. Tambah kolom foto ulasan (opsional)
ALTER TABLE product_reviews
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- ============================================================
-- 3. Buat Storage Bucket untuk foto ulasan (jika belum ada)
-- Jalankan di Supabase Dashboard > Storage jika bucket belum ada,
-- atau jalankan via SQL berikut:
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('review-photos', 'review-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: siapapun bisa baca foto ulasan
DROP POLICY IF EXISTS "Public read review photos" ON storage.objects;
CREATE POLICY "Public read review photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'review-photos');

-- Policy: user login bisa upload ke folder miliknya sendiri
DROP POLICY IF EXISTS "Users upload review photos" ON storage.objects;
CREATE POLICY "Users upload review photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'review-photos'
    AND auth.uid() IS NOT NULL
  );

-- Policy: user bisa hapus foto miliknya sendiri
DROP POLICY IF EXISTS "Users delete own review photos" ON storage.objects;
CREATE POLICY "Users delete own review photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'review-photos'
    AND auth.uid() IS NOT NULL
  );

-- ============================================================
-- Verifikasi
-- ============================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'product_reviews'
  AND column_name IN ('reviewer_name', 'photo_url');
