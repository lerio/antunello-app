-- Rollback for 028. Fails if two same-named categories of different types now
-- exist; delete one of each pair first.
drop index if exists public.custom_categories_unique_name;

create unique index custom_categories_unique_name
  on public.custom_categories (user_id, coalesce(parent_category, ''), lower(name));

alter table public.custom_categories alter column type drop not null;

update public.custom_categories set type = null where parent_category is not null;

alter table public.custom_categories
  add constraint custom_categories_type_matches_level check (
    (parent_category is null and type is not null)
    or (parent_category is not null and type is null)
  );
