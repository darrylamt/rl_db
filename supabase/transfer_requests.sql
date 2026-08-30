-- ============================================================
-- Clubs ask each other for players; the federation signs it off.
--
-- Moving a player meant someone editing players.team_id by hand, with the
-- agreement between the two clubs living in a phone call. Nothing recorded
-- who asked, who agreed, or when.
--
-- A request now travels: the club that wants the player asks, the club that
-- has them accepts or rejects, and only then does it reach the federation to
-- be signed off. The player does not move until that last step — an
-- agreement between two clubs is not a registration.
--
-- The trail is kept whatever the outcome. A rejected approach is worth as
-- much to look back on as an accepted one.
--
-- This is separate from /admin/transfers, which reads moves out of
-- player_history after they have happened. This is how they happen.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

create table if not exists transfer_requests (
  request_id   uuid primary key default gen_random_uuid(),

  player_id    uuid not null references players(player_id) on delete cascade,
  -- The club the player is at when the request is made. Kept rather than
  -- looked up later, because the answer changes the moment they move.
  from_team_id uuid references teams(team_id) on delete set null,
  to_team_id   uuid not null references teams(team_id) on delete cascade,

  kind         text not null default 'transfer'
               check (kind in ('transfer', 'loan')),
  -- A loan ends. A transfer does not.
  loan_until   date,

  -- with_club   the club holding the player has not answered
  -- rejected    they said no; it goes no further
  -- with_federation  they agreed, and it is waiting to be signed off
  -- approved    signed off and the player has moved
  -- declined    the federation refused it
  -- withdrawn   the asking club took it back
  status       text not null default 'with_club'
               check (status in ('with_club', 'rejected', 'with_federation',
                                 'approved', 'declined', 'withdrawn')),

  message      text,

  requested_by uuid,
  requested_at timestamptz not null default now(),

  club_answered_by uuid,
  club_answered_at timestamptz,
  club_note        text,

  reviewed_by  uuid,
  reviewed_at  timestamptz,
  review_note  text,

  constraint a_club_cannot_ask_itself check (from_team_id is distinct from to_team_id),
  constraint a_loan_needs_an_end_date check (kind <> 'loan' or loan_until is not null)
);

create index if not exists idx_transfer_requests_to on transfer_requests(to_team_id);
create index if not exists idx_transfer_requests_from on transfer_requests(from_team_id);
create index if not exists idx_transfer_requests_player on transfer_requests(player_id);
create index if not exists idx_transfer_requests_open on transfer_requests(status)
  where status in ('with_club', 'with_federation');

-- One live approach per player per club. Two clubs may both be asking, and
-- that is a real situation, but the same club asking twice is a mistake.
create unique index if not exists one_open_request_per_club_per_player
  on transfer_requests(player_id, to_team_id)
  where status in ('with_club', 'with_federation');

comment on table transfer_requests is
  'A move being asked for. The player only moves when the federation approves.';

-- ── Row level security ──────────────────────────────────────
-- Clubs reach this through the portal's server actions, which use the
-- service key and check ownership themselves — the same as team sheets and
-- the club squad pages. No client writes directly, and nothing here is
-- public, so there is no policy: RLS on with none denies every client.
alter table transfer_requests enable row level security;

-- ── What is on record ───────────────────────────────────────
select status, kind, count(*) as requests
from transfer_requests
group by status, kind
order by status, kind;
