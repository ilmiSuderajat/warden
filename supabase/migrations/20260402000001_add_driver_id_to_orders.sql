-- Migration: Add driver_id to orders table for easier querying and to fix commission RPC
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON public.orders(driver_id);

-- Backfill skipped because driver_orders might not exist locally

SELECT 'Migration: driver_id added to orders table successfully' as status;
