-- ======================================================
-- OPTIMASI PERFORMA CHAT
-- Jalankan script ini di Supabase SQL Editor
-- ======================================================

-- 1. Tambah index yang kurang
CREATE INDEX IF NOT EXISTS idx_shop_conversations_shop_id ON public.shop_conversations(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_messages_created_at ON public.shop_messages(conversation_id, created_at DESC);

-- 2. RPC: send_shop_message
-- Menggabungkan 4 query serial menjadi 1 atomic call:
--   a) INSERT pesan baru
--   b) UPDATE last_message + last_time di conversation
--   c) INCREMENT unread counter untuk penerima
-- Mengembalikan row pesan yang baru dibuat

CREATE OR REPLACE FUNCTION public.send_shop_message(
  p_conversation_id uuid,
  p_sender_id uuid,
  p_message text,
  p_role text  -- 'buyer' atau 'shop'
)
RETURNS public.shop_messages
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_message public.shop_messages;
BEGIN
  -- a) Insert pesan
  INSERT INTO public.shop_messages (conversation_id, sender_id, message)
  VALUES (p_conversation_id, p_sender_id, p_message)
  RETURNING * INTO v_new_message;

  -- b) Update conversation + increment unread penerima
  IF p_role = 'buyer' THEN
    UPDATE public.shop_conversations
    SET
      last_message = p_message,
      last_time = now(),
      unread_shop = unread_shop + 1
    WHERE id = p_conversation_id;
  ELSE
    UPDATE public.shop_conversations
    SET
      last_message = p_message,
      last_time = now(),
      unread_buyer = unread_buyer + 1
    WHERE id = p_conversation_id;
  END IF;

  RETURN v_new_message;
END;
$$;

-- 3. Grant akses ke authenticated users
GRANT EXECUTE ON FUNCTION public.send_shop_message(uuid, uuid, text, text) TO authenticated;
