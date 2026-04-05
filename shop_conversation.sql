-- 1. Drop old table
DROP TABLE IF EXISTS public.shop_chats;

-- 2. Create Conversations Table
CREATE TABLE public.shop_conversations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
    buyer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    last_message text,
    last_time timestamp with time zone DEFAULT now(),
    unread_shop int DEFAULT 0,
    unread_buyer int DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(shop_id, buyer_id)
);

-- 3. Create Messages Table
CREATE TABLE public.shop_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id uuid REFERENCES public.shop_conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE public.shop_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_messages ENABLE ROW LEVEL SECURITY;

-- 5. Policies for Conversations
CREATE POLICY "Users can view their conversations"
ON public.shop_conversations FOR SELECT
USING (
    auth.uid() = buyer_id OR 
    auth.uid() IN (SELECT owner_id FROM public.shops WHERE id = shop_conversations.shop_id)
);

CREATE POLICY "Users can insert conversations"
ON public.shop_conversations FOR INSERT
WITH CHECK (
    auth.uid() = buyer_id OR 
    auth.uid() IN (SELECT owner_id FROM public.shops WHERE id = shop_conversations.shop_id)
);

CREATE POLICY "Users can update their conversations"
ON public.shop_conversations FOR UPDATE
USING (
    auth.uid() = buyer_id OR 
    auth.uid() IN (SELECT owner_id FROM public.shops WHERE id = shop_conversations.shop_id)
);


-- 6. Policies for Messages
CREATE POLICY "Users can view messages from their conversations"
ON public.shop_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.shop_conversations c
        WHERE c.id = shop_messages.conversation_id
        AND (c.buyer_id = auth.uid() OR c.shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()))
    )
);

CREATE POLICY "Users can insert messages into their conversations"
ON public.shop_messages FOR INSERT
WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
        SELECT 1 FROM public.shop_conversations c
        WHERE c.id = shop_messages.conversation_id
        AND (c.buyer_id = auth.uid() OR c.shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()))
    )
);

CREATE POLICY "Users can update messages in their conversations (e.g. mark read)"
ON public.shop_messages FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.shop_conversations c
        WHERE c.id = shop_messages.conversation_id
        AND (c.buyer_id = auth.uid() OR c.shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()))
    )
);

-- 7. Add Realtime (Disembunyikan karena jika sudah dijalankan sebelumnya akan error)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_conversations;

-- 8. missing indexes for performance (fixes slow loading)
CREATE INDEX IF NOT EXISTS idx_shop_messages_conversation_id ON public.shop_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_shop_conversations_buyer_id ON public.shop_conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON public.addresses(user_id);

-- 9. Allow shop owner to view buyer addresses (fixes buyer name not showing)
CREATE POLICY "Shop owners can view addresses of their buyers"
ON public.addresses FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.shop_conversations c
        INNER JOIN public.shops s ON c.shop_id = s.id
        WHERE c.buyer_id = addresses.user_id AND s.owner_id = auth.uid()
    )
);
