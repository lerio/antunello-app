-- Database Performance Optimizations for Antunello
-- Run these in your Supabase SQL Editor after the initial migration

-- 1. Add composite indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_date_desc 
ON transactions(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_month_year 
ON transactions(user_id, EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date));

CREATE INDEX IF NOT EXISTS idx_transactions_user_category 
ON transactions(user_id, main_category);

CREATE INDEX IF NOT EXISTS idx_transactions_user_type_date 
ON transactions(user_id, type, date DESC);

-- 2. Optimize exchange_rates table indexes
DROP INDEX IF EXISTS idx_exchange_rates_date_currency;
CREATE INDEX idx_exchange_rates_lookup 
ON exchange_rates(target_currency, date DESC, base_currency) 
WHERE is_missing = false;

-- 3. Add partial index for missing rates (smaller index size)
DROP INDEX IF EXISTS idx_exchange_rates_missing;
CREATE INDEX idx_exchange_rates_missing_partial 
ON exchange_rates(target_currency, date DESC) 
WHERE is_missing = true;

-- 4. Create materialized view for monthly summaries (optional for heavy usage)
CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_summaries AS
SELECT 
    user_id,
    EXTRACT(YEAR FROM date) as year,
    EXTRACT(MONTH FROM date) as month,
    currency,
    type,
    SUM(amount) as total_amount,
    SUM(COALESCE(eur_amount, amount)) as total_eur_amount,
    COUNT(*) as transaction_count
FROM transactions
GROUP BY user_id, year, month, currency, type;

-- Index for the materialized view
CREATE INDEX IF NOT EXISTS idx_monthly_summaries_lookup 
ON monthly_summaries(user_id, year, month);

-- 5. Function to refresh monthly summaries (call this after transaction changes)
CREATE OR REPLACE FUNCTION refresh_monthly_summaries()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_summaries;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger to refresh summaries automatically (optional - may impact performance)
-- Uncomment if you want automatic refresh (not recommended for high-frequency apps)
/*
CREATE OR REPLACE FUNCTION refresh_summaries_trigger() NOSONAR: kept intentionally for optional auto-refresh example
RETURNS trigger AS $$ NOSONAR: kept intentionally for optional auto-refresh example
BEGIN NOSONAR: kept intentionally for optional auto-refresh example
    PERFORM refresh_monthly_summaries(); NOSONAR: kept intentionally for optional auto-refresh example
    RETURN NULL; NOSONAR: kept intentionally for optional auto-refresh example
END; NOSONAR: kept intentionally for optional auto-refresh example
$$ LANGUAGE plpgsql; NOSONAR: kept intentionally for optional auto-refresh example

DROP TRIGGER IF EXISTS trigger_refresh_summaries ON transactions; NOSONAR: kept intentionally for optional auto-refresh example
CREATE TRIGGER trigger_refresh_summaries NOSONAR: kept intentionally for optional auto-refresh example
    AFTER INSERT OR UPDATE OR DELETE ON transactions NOSONAR: kept intentionally for optional auto-refresh example
    FOR EACH STATEMENT NOSONAR: kept intentionally for optional auto-refresh example
    EXECUTE FUNCTION refresh_summaries_trigger(); NOSONAR: kept intentionally for optional auto-refresh example
*/
