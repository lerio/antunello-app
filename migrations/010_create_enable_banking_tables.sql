-- Enable moddatetime extension
create extension if not exists moddatetime schema extensions;

-- Create integration_configs table
create table if not exists integration_configs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text not null check (provider in ('enable_banking')),
  account_id text not null, -- External account ID (UID)
  last_sync_at timestamptz,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, provider, account_id)
);

-- Enable RLS for integration_configs
alter table integration_configs enable row level security;

-- Create policies for integration_configs
create policy "Users can view their own integration configs"
  on integration_configs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own integration configs"
  on integration_configs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own integration configs"
  on integration_configs for update
  using (auth.uid() = user_id);

create policy "Users can delete their own integration configs"
  on integration_configs for delete
  using (auth.uid() = user_id);

-- Create pending_transactions table
create table if not exists pending_transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  external_id text not null, -- ID from the external provider
  data jsonb not null, -- Stores raw amount, date, title, currency, etc.
  status text not null default 'pending' check (status in ('pending', 'dismissed', 'added')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, external_id)
);

-- Enable RLS for pending_transactions
alter table pending_transactions enable row level security;

-- Create policies for pending_transactions
create policy "Users can view their own pending transactions"
  on pending_transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own pending transactions"
  on pending_transactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own pending transactions"
  on pending_transactions for update
  using (auth.uid() = user_id);

create policy "Users can delete their own pending transactions"
  on pending_transactions for delete
  using (auth.uid() = user_id);

-- Add updated_at triggers
create trigger handle_updated_at_integration_configs
  before update on integration_configs
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at_pending_transactions
  before update on pending_transactions
  for each row execute procedure moddatetime (updated_at);
