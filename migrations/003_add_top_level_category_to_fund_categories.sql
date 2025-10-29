-- Add top_level_category column to fund_categories table
ALTER TABLE fund_categories
ADD COLUMN top_level_category TEXT;

-- Create index for better performance
CREATE INDEX idx_fund_categories_top_level_category ON fund_categories(top_level_category);