-- Rollback for 027_create_custom_categories.sql.
-- Transactions that used a custom category keep its name as text; they are not changed.
drop table if exists public.custom_categories;
