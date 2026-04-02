-- Migration to initialize wallets for users
-- 1. Function to create wallet if not exists
CREATE OR REPLACE FUNCTION public.init_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.wallets (user_id, balance)
    VALUES (NEW.id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger on public.users
DROP TRIGGER IF EXISTS tr_init_user_wallet ON public.users;
CREATE TRIGGER tr_init_user_wallet
AFTER INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION public.init_user_wallet();

-- 3. Backfill existing users who don't have a wallet
INSERT INTO public.wallets (user_id, balance)
SELECT id, 0 FROM public.users
ON CONFLICT (user_id) DO NOTHING;
