-- Create user_withdraw_requests table
CREATE TABLE IF NOT EXISTS user_withdraw_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    amount INTEGER NOT NULL CHECK (amount >= 10000),
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Permissions
ALTER TABLE user_withdraw_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own withdraw requests"
    ON user_withdraw_requests FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admin has full access to user withdraw requests"
    ON user_withdraw_requests FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );
