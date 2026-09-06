-- ============================================================
-- LeagueX: what a club can spend, and where it went.
--
-- Player values gave every player a number. This gives every club a purse,
-- which is the other half of the same idea: a value nobody has to pay is a
-- label, and labels do not stop seven players walking out of a club at once.
-- With a purse, a club that loses a player is paid for him and the club that
-- takes him is poorer for it.
--
-- WHAT IS STORED
--   One table. Every movement of LX is a row, and a balance is the sum of the
--   rows — never a column somebody has to remember to update. A club's whole
--   financial history and the federation's income both fall out of it for
--   free, and nothing can drift out of step with anything else.
--
--   The federation is a holder like any other, written as team_id null. Its
--   balance is what the levy has brought in.
--
-- THE FIVE KINDS
--   allocation  the federation grants a club its budget for a season
--   expiry      carry-over above the cap, removed at the start of a season
--   fee         a transfer or loan fee: minus the buyer, plus the seller
--   levy        the federation's cut: minus the buyer, plus the federation
--   adjustment  a correction made by hand, either way, always with a note
--
--   Money is created by allocation and destroyed by expiry. Everything else
--   moves it between holders and sums to nothing, which is what makes the
--   totals checkable.
--
-- WHAT THIS DOES NOT DO
--   It does not stop a club spending past its balance. A club that goes
--   overdrawn is shown as overdrawn, to itself and to the federation, and
--   the federation can refuse the move at sign-off — but the system warns
--   rather than refuses.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

create table if not exists lx_ledger (
  entry_id   uuid primary key default gen_random_uuid(),

  -- Who the entry belongs to. Null is the federation's own account, which is
  -- why there is no foreign key requirement here.
  team_id    uuid references teams(team_id) on delete cascade,

  kind       text not null
             check (kind in ('allocation', 'expiry', 'fee', 'levy', 'adjustment')),

  -- Signed, and always from this holder's point of view: what it did to
  -- their balance. A fee is one row of each sign, so the pair cancels.
  amount     integer not null,

  -- The season an allocation is for. Also stamped on everything else, so a
  -- club can read a season's trading on its own.
  season     text,

  -- What the entry was about, where there was something.
  player_id             uuid references players(player_id) on delete set null,
  counterparty_team_id  uuid references teams(team_id) on delete set null,
  request_id            uuid references transfer_requests(request_id) on delete set null,

  note       text,
  created_by uuid,
  created_at timestamptz not null default now(),

  constraint an_allocation_is_positive check (kind <> 'allocation' or amount > 0),
  constraint an_expiry_is_negative     check (kind <> 'expiry' or amount < 0),
  constraint an_adjustment_needs_a_reason
    check (kind <> 'adjustment' or (note is not null and length(btrim(note)) > 0))
);

create index if not exists idx_lx_ledger_team on lx_ledger(team_id);
create index if not exists idx_lx_ledger_created on lx_ledger(created_at desc);
create index if not exists idx_lx_ledger_request on lx_ledger(request_id);

-- A season's budget is granted once. Without this, two clicks on the same
-- button is a club with two budgets.
create unique index if not exists one_allocation_per_club_per_season
  on lx_ledger(team_id, season) where kind = 'allocation';

comment on table lx_ledger is
  'Every movement of LeagueX. A balance is the sum of these rows; team_id null is the federation.';

-- ── The price, fixed when the deal is struck ────────────────
-- Values move as records are corrected. A fee agreed in March and signed off
-- in May has to be the March fee, so it is written onto the request at the
-- moment of asking rather than looked up again at sign-off.
alter table transfer_requests add column if not exists fee  integer;
alter table transfer_requests add column if not exists levy integer;

comment on column transfer_requests.fee is
  'What the buying club pays the selling club, quoted when the request was made.';
comment on column transfer_requests.levy is
  'The federation''s cut, paid by the buyer on top of the fee.';

-- ── Row level security ──────────────────────────────────────
-- Reached only through server actions holding the service key, which check
-- who is asking themselves — the same as transfer_requests and team sheets.
-- RLS on with no policy denies every client, which is the intent.
alter table lx_ledger enable row level security;

-- ── What is on record ───────────────────────────────────────
select
  coalesce(t.name, 'FEDERATION') as holder,
  sum(l.amount)                  as balance,
  count(*)                       as entries
from lx_ledger l
left join teams t on t.team_id = l.team_id
group by t.name
order by balance desc;
