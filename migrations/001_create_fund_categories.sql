-- Create fund_categories table
CREATE TABLE IF NOT EXISTS fund_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_fund_categories_user_id ON fund_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_fund_categories_order ON fund_categories(user_id, order_index);
CREATE INDEX IF NOT EXISTS idx_fund_categories_active ON fund_categories(user_id, is_active);

-- Enable Row Level Security
ALTER TABLE fund_categories ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view own fund categories" ON fund_categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fund categories" ON fund_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fund categories" ON fund_categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own fund categories" ON fund_categories
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_fund_categories_updated_at
  BEFORE UPDATE ON fund_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();