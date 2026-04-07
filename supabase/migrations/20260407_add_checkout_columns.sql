-- Migration: Add missing columns for checkout and order_items
-- Run this in Supabase SQL Editor

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_note TEXT;

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_id TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS final_price NUMERIC;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variants JSONB;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS image_url TEXT;
