-- Migration to add currency conversion support
-- Run this in your Supabase SQL Editor: https://app.supabase.com/project/llgvbhdrovnfnisbduze/sql

-- 1. Add currency conversion columns to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS eur_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10,5),
ADD COLUMN IF NOT EXISTS rate_date DATE;

-- 2. Create exchange_rates table for caching rates
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  base_currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  target_currency VARCHAR(3) NOT NULL,
  rate DECIMAL(10,5) NOT NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'exchangerate.host',
  is_missing BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Unique constraint to prevent duplicate rates for same date/currency pair
  UNIQUE(date, base_currency, target_currency)
);

-- 3. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_exchange_rates_date_currency 
ON exchange_rates(date, base_currency, target_currency);

-- 4. Create index for missing rates
CREATE INDEX IF NOT EXISTS idx_exchange_rates_missing 
ON exchange_rates(target_currency, is_missing) 
WHERE is_missing = true;

-- 5. Add RLS (Row Level Security) policy for exchange_rates table
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read exchange rates
CREATE POLICY "Allow authenticated users to read exchange rates" ON exchange_rates
FOR SELECT TO authenticated USING (true);

-- Allow all authenticated users to insert/update exchange rates
CREATE POLICY "Allow authenticated users to insert exchange rates" ON exchange_rates
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update exchange rates" ON exchange_rates
FOR UPDATE TO authenticated USING (true);

-- 6. Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 7. Create trigger for exchange_rates table
DROP TRIGGER IF EXISTS update_exchange_rates_updated_at ON exchange_rates;
CREATE TRIGGER update_exchange_rates_updated_at
    BEFORE UPDATE ON exchange_rates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 8. (Optional) Update existing EUR transactions to have eur_amount = amount
UPDATE transactions
SET eur_amount = amount,
    exchange_rate = 1.0,
    rate_date = DATE(date)
WHERE currency = 'EUR' AND eur_amount IS NULL;

-- 9. Create transaction_title_patterns table for title suggestions
CREATE TABLE IF NOT EXISTS transaction_title_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('expense', 'income')),
  main_category TEXT NOT NULL,
  sub_category TEXT,
  frequency INTEGER DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Unique constraint to prevent duplicate patterns for same user/title/type/category combination
  UNIQUE(user_id, title, type, main_category, sub_category)
);

-- 10. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transaction_title_patterns_user_title
ON transaction_title_patterns(user_id, title);

CREATE INDEX IF NOT EXISTS idx_transaction_title_patterns_user_frequency
ON transaction_title_patterns(user_id, frequency DESC);

CREATE INDEX IF NOT EXISTS idx_transaction_title_patterns_user_category
ON transaction_title_patterns(user_id, main_category, sub_category);

-- 11. Add RLS (Row Level Security) policy for transaction_title_patterns table
ALTER TABLE transaction_title_patterns ENABLE ROW LEVEL SECURITY;

-- Allow users to read only their own patterns
CREATE POLICY "Allow users to read their own title patterns" ON transaction_title_patterns
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Allow users to insert their own patterns
CREATE POLICY "Allow users to insert their own title patterns" ON transaction_title_patterns
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own patterns
CREATE POLICY "Allow users to update their own title patterns" ON transaction_title_patterns
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Allow users to delete their own patterns
CREATE POLICY "Allow users to delete their own title patterns" ON transaction_title_patterns
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 12. Create trigger for transaction_title_patterns table
DROP TRIGGER IF EXISTS update_transaction_title_patterns_updated_at ON transaction_title_patterns;
CREATE TRIGGER update_transaction_title_patterns_updated_at
    BEFORE UPDATE ON transaction_title_patterns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 13. Create function to update title patterns when transactions are created/updated
CREATE OR REPLACE FUNCTION update_transaction_title_patterns()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert or update pattern for this transaction
    INSERT INTO transaction_title_patterns (user_id, title, type, main_category, sub_category, frequency, last_used_at)
    VALUES (NEW.user_id, NEW.title, NEW.type, NEW.main_category, NEW.sub_category, 1, NEW.date)
    ON CONFLICT (user_id, title, type, main_category, sub_category)
    DO UPDATE SET
        frequency = transaction_title_patterns.frequency + 1,
        last_used_at = GREATEST(transaction_title_patterns.last_used_at, NEW.date),
        updated_at = timezone('utc'::text, now());

    RETURN NEW;
END;
$$ language 'plpgsql';

-- 14. Create triggers for transactions table
DROP TRIGGER IF EXISTS update_title_patterns_on_insert ON transactions;
CREATE TRIGGER update_title_patterns_on_insert
    AFTER INSERT ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_transaction_title_patterns();

DROP TRIGGER IF EXISTS update_title_patterns_on_update ON transactions;
CREATE TRIGGER update_title_patterns_on_update
    AFTER UPDATE ON transactions
    FOR EACH ROW
    WHEN (OLD.title IS DISTINCT FROM NEW.title OR OLD.type IS DISTINCT FROM NEW.type OR
          OLD.main_category IS DISTINCT FROM NEW.main_category OR OLD.sub_category IS DISTINCT FROM NEW.sub_category)
    EXECUTE FUNCTION update_transaction_title_patterns();

-- 15. Create function to clean up old patterns
CREATE OR REPLACE FUNCTION cleanup_old_title_patterns()
RETURNS void AS $$
BEGIN
    -- Delete patterns with frequency=1 that are older than 90 days
    DELETE FROM transaction_title_patterns
    WHERE frequency = 1
    AND last_used_at < (timezone('utc'::text, now()) - INTERVAL '90 days');
END;
$$ language 'plpgsql';