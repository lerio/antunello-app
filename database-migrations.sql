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