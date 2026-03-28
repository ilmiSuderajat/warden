-- ============================================================
-- MIGRATION: Product Rating & Sold Count
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. Tambah kolom sold_count dan rating ke produk
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sold_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating NUMERIC(2,1) DEFAULT 5.0;

-- 2. Buat tabel ulasan produk (product_reviews)
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure max 1 review per user per product per order
  UNIQUE(product_id, order_id, user_id)
);

-- 3. Row Level Security untuk product_reviews
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

-- Semua orang bisa baca ulasan
DROP POLICY IF EXISTS "Anyone can view reviews" ON product_reviews;
CREATE POLICY "Anyone can view reviews" ON product_reviews
  FOR SELECT USING (true);

-- User hanya bisa buat ulasan pakai ID mereka sendiri
DROP POLICY IF EXISTS "Users can create their own reviews" ON product_reviews;
CREATE POLICY "Users can create their own reviews" ON product_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User bisa edit ulasannya sendiri
DROP POLICY IF EXISTS "Users can update their own reviews" ON product_reviews;
CREATE POLICY "Users can update their own reviews" ON product_reviews
  FOR UPDATE USING (auth.uid() = user_id);

-- 4. Function untuk update rating rata-rata di produk setelah ulasan baru
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE products
    SET rating = (
      SELECT ROUND(AVG(rating)::numeric, 1)
      FROM product_reviews
      WHERE product_id = NEW.product_id
    )
    WHERE id = NEW.product_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE products
    SET rating = COALESCE((
      SELECT ROUND(AVG(rating)::numeric, 1)
      FROM product_reviews
      WHERE product_id = OLD.product_id
    ), 5.0)
    WHERE id = OLD.product_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger untuk auto-update rating saat diulas
DROP TRIGGER IF EXISTS trigger_update_product_rating ON product_reviews;
CREATE TRIGGER trigger_update_product_rating
AFTER INSERT OR UPDATE OR DELETE ON product_reviews
FOR EACH ROW EXECUTE FUNCTION update_product_rating();

-- 6. Function to increment sold count
CREATE OR REPLACE FUNCTION increment_product_sold_count(p_id UUID, qty INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE products
  SET sold_count = COALESCE(sold_count, 0) + qty
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SELESAI
-- ============================================================
