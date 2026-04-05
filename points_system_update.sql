-- Add points_reward column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS points_reward INTEGER DEFAULT 0;

-- Add points_balance column to wallets table
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS points_balance INTEGER DEFAULT 0;
