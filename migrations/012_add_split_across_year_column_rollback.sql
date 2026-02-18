-- Rollback for: 012_add_split_across_year_column.sql

drop index if exists idx_transactions_user_split_year;

alter table transactions
drop column if exists split_across_year;
