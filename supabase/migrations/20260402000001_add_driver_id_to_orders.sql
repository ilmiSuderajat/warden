-- Migration: Add driver_id to orders table for easier querying and to fix commission RPC
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON public.orders(driver_id);

-- Backfill driver_id for orders that are already accepted or further in lifecycle
-- We look at the most recent 'accepted' driver_order for each order
UPDATE public.orders o
SET driver_id = do.driver_id
FROM (
    SELECT DISTINCT ON (order_id) order_id, driver_id
    FROM public.driver_orders
    WHERE status IN ('accepted', 'delivered', 'arrived_at_store', 'picked_up', 'arrived_at_location')
    ORDER BY order_id, created_at DESC
) do
WHERE o.id = do.order_id AND o.driver_id IS NULL;

SELECT 'Migration: driver_id added to orders table successfully' as status;
