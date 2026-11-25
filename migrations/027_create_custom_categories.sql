-- 027_create_custom_categories.sql
--
-- User-defined categories, on top of the built-in ones in types/database.ts.
--
--   main category:  parent_category IS NULL,     type = 'income' | 'expense'
--   subcategory:    parent_category = <name of a main category, built-in or custom>, type IS NULL
--
-- A subcategory has no type of its own: it follows its main category's.
-- Built-in categories are not rows here, so parent_category is a name, not a foreign key.
-- `icon` is a Lucide component name (e.g. 'Utensils'); null means the default icon.
--
-- Apply by hand in the Supabase SQL editor.

create table if not exists public.custom_categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null check (length(btrim(name)) > 0),
  parent_category text,
  type text check (type in ('income', 'expense')),
  icon text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

  -- Main categories carry a type; subcategories never do.
  constraint custom_categories_type_matches_level check (
    (parent_category is null and type is not null)
    or (parent_category is not null and type is null)
  )
);

-- No duplicate names within a level (case-insensitive): one namespace for main
-- categories, one per parent for subcategories.
create unique index if not exists custom_categories_unique_name
  on public.custom_categories (user_id, coalesce(parent_category, ''), lower(name));

create index if not exists custom_categories_user_idx
  on public.custom_categories (user_id);

alter table public.custom_categories enable row level security;

create policy "Users can view their own custom categories"
  on public.custom_categories for select
  using (auth.uid() = user_id);

create policy "Users can insert their own custom categories"
  on public.custom_categories for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own custom categories"
  on public.custom_categories for update
  using (auth.uid() = user_id);

create policy "Users can delete their own custom categories"
  on public.custom_categories for delete
  using (auth.uid() = user_id);

-- handle_updated_at() is created in 009_create_budgets_table.sql.
create trigger handle_custom_categories_updated_at
  before update on public.custom_categories
  for each row
  execute function public.handle_updated_at();
