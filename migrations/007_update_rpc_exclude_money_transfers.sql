-- Migration: Update RPC functions to exclude money transfers
-- Date: 2025-12-03
-- Description: Exclude money transfers from overall totals and balance calculations

-- Update get_overall_total_eur to exclude money transfers and hidden transactions
CREATE OR REPLACE FUNCTION public.get_overall_total_eur(p_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(
    CASE WHEN t.type = 'income'
      THEN COALESCE(t.eur_amount, t.amount)
      ELSE -COALESCE(t.eur_amount, t.amount)
    END
  ), 0) AS overall_eur_total
  FROM public.transactions t
  WHERE t.user_id = p_user_id
    AND t.is_money_transfer = false  -- Exclude money transfers
    AND (t.hide_from_totals = false OR t.hide_from_totals IS NULL)  -- Exclude hidden transactions
$$;

-- Update get_balance_before_date to exclude money transfers
CREATE OR REPLACE FUNCTION public.get_balance_before_date(
  p_user_id uuid,
  p_date date,
  p_include_hidden boolean DEFAULT false
)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(
    CASE WHEN t.type = 'income'
      THEN COALESCE(t.eur_amount, t.amount)
      ELSE -COALESCE(t.eur_amount, t.amount)
    END
  ), 0) AS balance_before_date
  FROM public.transactions t
  WHERE t.user_id = p_user_id
    AND t.date < p_date
    AND t.is_money_transfer = false  -- Exclude money transfers
    AND (p_include_hidden = true OR t.hide_from_totals = false)  -- Conditionally exclude hidden
$$;

-- Add comments
COMMENT ON FUNCTION public.get_overall_total_eur(uuid) IS 'Returns overall signed EUR total for a user, excluding money transfers and hidden transactions';
COMMENT ON FUNCTION public.get_balance_before_date(uuid, date, boolean) IS 'Returns cumulative EUR balance for a user before a specific date, excluding money transfers and optionally hidden transactions';
