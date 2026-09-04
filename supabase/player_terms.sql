-- ----------------------------------------------------------------------
-- What a player agreed to, and when.
--
-- Two parts on purpose. app_users carries the version currently accepted,
-- because the middleware already reads that row on every request and asking
-- a second table each time would cost a round trip to learn one string.
-- The decisions table is the record itself: every answer, including the
-- refusals, kept rather than overwritten.
--
-- A refusal is worth keeping. It is a real answer to a real question, and
-- "they were asked and said no" is exactly what nobody can reconstruct later
-- if only agreement is stored.
-- ----------------------------------------------------------------------

alter table app_users
  add column if not exists terms_version text;

comment on column app_users.terms_version is
  'The terms version this account has accepted. Null means they have not, and the player portal will ask before letting them in.';

create table if not exists player_terms_decisions (
  decision_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(user_id) on delete cascade,
  player_id uuid references players(player_id) on delete set null,
  version text not null,
  accepted boolean not null,
  decided_at timestamptz not null default now()
);

create index if not exists player_terms_decisions_user_idx
  on player_terms_decisions (user_id, decided_at desc);

-- Service role only, like everything else here: the portal writes this
-- through a server action, never the browser.
alter table player_terms_decisions enable row level security;
