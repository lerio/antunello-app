-- Widen the integration_configs provider check constraint to accept
-- 'trade_republic' in addition to 'enable_banking'.
alter table integration_configs
  drop constraint if exists integration_configs_provider_check,
  add constraint integration_configs_provider_check
    check (provider in ('enable_banking', 'trade_republic'));
