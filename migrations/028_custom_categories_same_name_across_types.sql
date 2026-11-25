-- 028_custom_categories_same_name_across_types.sql
--
-- Lets two main categories share a name when their types differ (an income
-- "Gifts" next to an expense "Gifts"), for custom categories and against the
-- built-in ones.
--
-- A subcategory now stores its parent's type (it used to be null), so it can be
-- attached to the right one of two same-named parents. Uniqueness is per
-- (parent, name, type): the same subcategory name can no longer appear twice
-- under one parent, but two same-named parents each get their own.
--
-- Apply by hand in the Supabase SQL editor, after 027.

-- 1. Drop the old rule (subcategories must have no type) first: the backfill below
--    would violate it.
alter table public.custom_categories
  drop constraint if exists custom_categories_type_matches_level;

-- 2. Backfill the type of existing subcategories from their parent: a custom
--    parent's own type, otherwise the built-in parent's type.
update public.custom_categories sub
set type = coalesce(
  (select p.type from public.custom_categories p
    where p.user_id = sub.user_id
      and p.parent_category is null
      and p.name = sub.parent_category
    limit 1),
  case when sub.parent_category in (
    'Bank Movements', 'Government Benefits', 'Other Income', 'Primary Income'
  ) then 'income' else 'expense' end
)
where sub.parent_category is not null
  and sub.type is null;

-- 3. Every row has a type now.
alter table public.custom_categories
  alter column type set not null;

-- 4. Unique per (parent, name, type), case-insensitive.
drop index if exists public.custom_categories_unique_name;

create unique index if not exists custom_categories_unique_name
  on public.custom_categories (user_id, coalesce(parent_category, ''), lower(name), type);
