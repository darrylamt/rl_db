-- ============================================================
-- The player is part of their own transfer.
--
-- Until now a move went club, club, federation — and the person being
-- moved was never asked. Two clubs agreeing a fee is not a transfer; the
-- player has to want to go. This puts them in the chain where football puts
-- them: the selling club agrees, then the player agrees, and only then does
-- it reach the federation.
--
-- And the other direction: a player can ask their own club for a move. The
-- club can accept, which makes them available, or refuse. Either way it is
-- on record, which is the point — a request that only ever happened in a
-- conversation is a request nobody can be held to.
--
-- Run AFTER transfer_requests.sql. Safe to re-run.
-- ============================================================

-- ── 1. A step for the player ────────────────────────────────
alter table transfer_requests drop constraint if exists transfer_requests_status_check;
alter table transfer_requests
  add constraint transfer_requests_status_check
  check (status in (
    'with_club',        -- the club holding them has not answered
    'rejected',         -- that club said no
    'with_player',      -- the club agreed; it is the player's decision now
    'player_declined',  -- the player does not want to go
    'with_federation',  -- both agreed, waiting to be signed off
    'approved',
    'declined',
    'withdrawn'
  ));

alter table transfer_requests
  add column if not exists player_answered_at timestamptz,
  add column if not exists player_note        text;

comment on column transfer_requests.status is
  'with_club, then with_player, then with_federation. Nobody moves until all three agree.';

-- Anything already agreed by a club and sitting with the federation stays
-- there. Those were agreed under the old rule and re-opening them would
-- undo decisions people have already made.

-- ── 2. A player can ask to leave ────────────────────────────
create table if not exists player_transfer_requests (
  request_id  uuid primary key default gen_random_uuid(),
  player_id   uuid not null references players(player_id) on delete cascade,
  -- The club they are asking. Kept rather than looked up later, because the
  -- answer changes the moment they move.
  team_id     uuid references teams(team_id) on delete set null,

  reason      text,
  -- pending   the club has not answered
  -- accepted  the club is willing to let them go
  -- rejected  the club is not
  -- withdrawn the player thought better of it
  status      text not null default 'pending'
              check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),

  club_note   text,
  created_at  timestamptz not null default now(),
  answered_at timestamptz
);

create index if not exists idx_ptr_player on player_transfer_requests(player_id);
create index if not exists idx_ptr_team on player_transfer_requests(team_id);

-- One open request at a time. A player asking twice is not asking harder.
create unique index if not exists one_open_request_per_player
  on player_transfer_requests(player_id)
  where status = 'pending';

comment on table player_transfer_requests is
  'A player formally asking their club for a move. Accepted means the club is willing to listen to offers.';

alter table player_transfer_requests enable row level security;

-- ── Where things stand ──────────────────────────────────────
select
  (select count(*) from transfer_requests where status = 'with_club')       as waiting_on_a_club,
  (select count(*) from transfer_requests where status = 'with_player')     as waiting_on_a_player,
  (select count(*) from transfer_requests where status = 'with_federation') as waiting_on_the_federation,
  (select count(*) from player_transfer_requests where status = 'pending')  as players_asking_to_leave;
