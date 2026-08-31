-- ============================================================
-- Contracts, player accounts, and availability.
--
-- Three things that only make sense together.
--
-- A contract is an agreement between a club and a player, so the player has
-- to be able to answer it — which means players need accounts of their own.
-- And once a player has an account, the other thing they are the authority
-- on is whether they are available, so signing out of a match belongs here
-- too.
--
-- A player account can read everything about that player and change almost
-- nothing. The two things it decides are the two things nobody else can
-- decide for them: whether they accept a contract, and whether they are
-- available.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- ── 1. Players get accounts ─────────────────────────────────
alter table app_users drop constraint if exists app_users_role_check;
alter table app_users
  add constraint app_users_role_check
  check (role in ('federation', 'club', 'recorder', 'player'));

alter table app_users
  add column if not exists player_id uuid references players(player_id) on delete cascade;

-- Seeded accounts all share one password, so the first thing an account does
-- is stop sharing it.
alter table app_users
  add column if not exists must_change_password boolean not null default false;

alter table app_users drop constraint if exists player_account_needs_a_player;
alter table app_users
  add constraint player_account_needs_a_player
  check (role <> 'player' or player_id is not null);

create unique index if not exists one_account_per_player
  on app_users(player_id) where player_id is not null;

comment on column app_users.player_id is
  'The player this account speaks for. Null for every other kind of account.';

-- ── 2. Contracts ────────────────────────────────────────────
create table if not exists contracts (
  contract_id  uuid primary key default gen_random_uuid(),
  player_id    uuid not null references players(player_id) on delete cascade,
  team_id      uuid not null references teams(team_id) on delete cascade,

  starts_on    date not null,
  ends_on      date not null,

  -- offered    the club has proposed it and the player has not answered
  -- accepted   the player agreed; it runs from starts_on
  -- declined   the player said no
  -- withdrawn  the club took it back before it was answered
  -- terminated ended early by agreement or by the federation
  status       text not null default 'offered'
               check (status in ('offered', 'accepted', 'declined', 'withdrawn', 'terminated')),

  terms        text,
  decline_note text,

  offered_by   uuid,
  offered_at   timestamptz not null default now(),
  answered_at  timestamptz,
  ended_at     timestamptz,
  ended_note   text,

  -- Six months to two years. Short enough that a club cannot tie a player up
  -- indefinitely, long enough to be worth signing.
  constraint contract_runs_at_least_six_months
    check (ends_on >= (starts_on + interval '6 months')::date),
  constraint contract_runs_at_most_two_years
    check (ends_on <= (starts_on + interval '2 years')::date)
);

create index if not exists idx_contracts_player on contracts(player_id);
create index if not exists idx_contracts_team on contracts(team_id);
create index if not exists idx_contracts_open on contracts(status)
  where status in ('offered', 'accepted');

-- A player cannot be weighing two offers from the same club at once, and
-- cannot hold two live contracts with it either.
create unique index if not exists one_live_contract_per_club_per_player
  on contracts(player_id, team_id)
  where status in ('offered', 'accepted');

comment on table contracts is
  'A club''s agreement with a player. Six months to two years; only the player can accept it.';

-- ── 3. Availability ─────────────────────────────────────────
-- Recorded per fixture rather than per week: a club needs to know about this
-- match, and a round can carry more than one.
create table if not exists player_availability (
  availability_id uuid primary key default gen_random_uuid(),
  player_id  uuid not null references players(player_id) on delete cascade,
  fixture_id uuid not null references fixtures(fixture_id) on delete cascade,

  -- in   put themselves forward
  -- out  unavailable, and cannot be named
  -- No row at all means neither, and they can be named as normal — silence
  -- is not a refusal.
  status     text not null check (status in ('in', 'out')),
  note       text,
  updated_at timestamptz not null default now(),

  constraint one_answer_per_player_per_fixture unique (player_id, fixture_id)
);

create index if not exists idx_availability_fixture on player_availability(fixture_id);

comment on table player_availability is
  'Whether a player has put themselves forward or ruled themselves out. No row means neither.';

-- ── Row level security ──────────────────────────────────────
-- Everything goes through server actions holding the service key, which
-- check who is asking. Contracts are public in the sense that a player's
-- contract end shows on their profile, so reading is allowed; nothing is
-- written by a client.
alter table contracts enable row level security;
alter table player_availability enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'contracts' and policyname = 'public read accepted contracts') then
    create policy "public read accepted contracts" on contracts
      for select using (status in ('accepted', 'terminated'));
  end if;
end $$;

-- ── Where things stand ──────────────────────────────────────
select
  (select count(*) from players)                                as players,
  (select count(*) from players where playing_status = 'active') as active_players,
  (select count(*) from app_users where role = 'player')        as player_accounts,
  (select count(*) from contracts)                              as contracts,
  (select count(*) from player_availability)                    as availability_answers;
