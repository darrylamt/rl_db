-- ============================================================
-- Federation settings: small values the federation sets once and the
-- platform reads, such as the General Manager's signature printed on ID
-- cards and transfer sheets.
--
-- One row per setting, the value as JSON.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

create table if not exists federation_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table federation_settings enable row level security;

-- Newer Supabase projects don't grant new tables to the API roles, so the
-- server's key is given access explicitly. Nobody else gets any.
grant select, insert, update on federation_settings to service_role;
revoke all on federation_settings from anon, authenticated;
