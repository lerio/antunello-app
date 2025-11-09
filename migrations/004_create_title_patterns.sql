-- Migration: Create transaction_title_patterns table and related functions
-- This migration adds support for transaction title suggestions and auto-completion

-- Create the transaction_title_patterns table
CREATE TABLE IF NOT EXISTS transaction_title_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type transaction_type NOT NULL,
    main_category TEXT NOT NULL,
    sub_category TEXT,
    frequency INTEGER NOT NULL DEFAULT 1,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint to prevent duplicate patterns per user
    UNIQUE(user_id, title, type, main_category, sub_category)
);

-- Create indexes for efficient searching
CREATE INDEX IF NOT EXISTS idx_transaction_title_patterns_user_id ON transaction_title_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_title_patterns_title_lower ON transaction_title_patterns(LOWER(title));
CREATE INDEX IF NOT EXISTS idx_transaction_title_patterns_frequency ON transaction_title_patterns(frequency DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_title_patterns_last_used ON transaction_title_patterns(last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_title_patterns_user_frequency ON transaction_title_patterns(user_id, frequency DESC);

-- Enable Row Level Security
ALTER TABLE transaction_title_patterns ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own title patterns" ON transaction_title_patterns
    FOR ALL USING (auth.uid() = user_id);

-- Create function to update title patterns when transactions are created/updated
CREATE OR REPLACE FUNCTION update_title_patterns()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert or update the pattern in transaction_title_patterns
    INSERT INTO transaction_title_patterns (
        user_id,
        title,
        type,
        main_category,
        sub_category,
        frequency,
        last_used_at
    )
    VALUES (
        NEW.user_id,
        NEW.title,
        NEW.type,
        NEW.main_category,
        NEW.sub_category,
        1,
        NEW.date
    )
    ON CONFLICT (user_id, title, type, main_category, sub_category)
    DO UPDATE SET
        frequency = transaction_title_patterns.frequency + 1,
        last_used_at = NEW.date,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new transactions
DROP TRIGGER IF EXISTS trigger_update_title_patterns_insert ON transactions;
CREATE TRIGGER trigger_update_title_patterns_insert
    AFTER INSERT ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_title_patterns();

-- Create trigger for updated transactions
DROP TRIGGER IF EXISTS trigger_update_title_patterns_update ON transactions;
CREATE TRIGGER trigger_update_title_patterns_update
    AFTER UPDATE ON transactions
    FOR EACH ROW
    WHEN (
        OLD.title IS DISTINCT FROM NEW.title OR
        OLD.type IS DISTINCT FROM NEW.type OR
        OLD.main_category IS DISTINCT FROM NEW.main_category OR
        OLD.sub_category IS DISTINCT FROM NEW.sub_category
    )
    EXECUTE FUNCTION update_title_patterns();

-- Create function to cleanup old patterns (optional admin function)
CREATE OR REPLACE FUNCTION cleanup_old_title_patterns()
RETURNS void AS $$
BEGIN
    -- Delete patterns that haven't been used in over 1 year
    DELETE FROM transaction_title_patterns
    WHERE last_used_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;