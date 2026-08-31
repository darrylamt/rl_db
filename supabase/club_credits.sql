-- ============================================================
-- The Club Credit System.
--
-- Two tables and a setting.
--
-- credit_rules is the RLFG Club Credit Regulations as data: every action
-- worth credits, what it is worth, whether the system can award it by
-- itself, and whether it needs a human to look first. The federation can
-- change a value without anyone touching code.
--
-- club_credits is the ledger. Every award and deduction is a row that is
-- never edited — a balance is the sum of the rows, not a number kept
-- somewhere and adjusted. That is what makes section 8 of the concept note
-- possible: a club can be shown exactly how it got where it is, and a
-- dispute six months on has something to read.
--
-- The amount is copied onto the row rather than read from the rule, because
-- changing what a red card costs next season must not rewrite what it cost
-- last season.
--
-- 2026 runs as a rehearsal. Credits are calculated and clubs can watch their
-- wallet, but nothing is redeemable — no club can be penalised under rules
-- it did not have. live_from_season decides where that stops.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- ── The regulations, as data ────────────────────────────────
create table if not exists credit_rules (
  code            text primary key,
  area            text not null,
  label           text not null,
  amount          integer not null,

  -- The system can work this out from what it already records.
  automatic       boolean not null default false,
  -- Serious or disputed matters are flagged, never deducted on their own.
  requires_review boolean not null default false,
  -- Most credits a club may earn from this in one season. Null is no limit.
  season_cap      integer,

  active          boolean not null default true,
  sort_order      integer not null default 0
);

comment on table credit_rules is
  'What each action is worth. Editable by the federation; the ledger keeps its own copy of the amount.';

insert into credit_rules (code, area, label, amount, automatic, requires_review, season_cap, sort_order) values
  -- Finance
  ('dues_paid_on_time',        'Finance',            'Pay annual dues on time',                    300, false, false, 1,  1),
  ('dues_late',                'Finance',            'Late payment of dues',                      -100, false, false, 1,  39),
  ('dues_outstanding',         'Finance',            'Outstanding dues after deadline',           -200, false, true,  1,  40),

  -- Administration
  ('admin_documents',          'Administration',     'Maintain all required club documents',        50, false, false, 1,  2),
  ('annual_report',            'Administration',     'Submit annual report on time',                20, false, false, 1,  3),
  ('agm_minutes',              'Administration',     'Hold AGM and submit minutes',                 20, false, false, 1,  4),
  ('head_coach',               'Administration',     'Maintain qualified Head Coach',               20, false, false, 1,  5),
  ('min_20_players',           'Administration',     'Maintain minimum 20 registered players',      30, true,  false, 1,  6),
  ('admin_documents_missing',  'Administration',     'Failure to maintain club documentation',     -20, false, false, 1,  35),
  ('annual_report_missing',    'Administration',     'Failure to submit annual report',            -20, false, false, 1,  36),
  ('agm_missing',              'Administration',     'Failure to hold AGM or submit minutes',      -20, false, false, 1,  37),
  ('head_coach_missing',       'Administration',     'Failure to maintain qualified Head Coach',   -20, false, false, 1,  38),

  -- Competition
  ('fixture_fulfilled',        'Competition',        'Fulfil scheduled fixture',                    10, true,  false, null, 7),
  ('match_won',                'Competition',        'Win a league match',                           5, true,  false, null, 8),
  ('league_position_1',        'Competition',        'Final league position - 1st',                 50, true,  false, 1,  9),
  ('league_position_2',        'Competition',        'Final league position - 2nd',                 40, true,  false, 1,  10),
  ('league_position_3',        'Competition',        'Final league position - 3rd',                 30, true,  false, 1,  11),
  ('league_position_4',        'Competition',        'Final league position - 4th',                 20, true,  false, 1,  12),
  ('league_position_5',        'Competition',        'Final league position - 5th',                 10, true,  false, 1,  13),
  ('league_position_6',        'Competition',        'Final league position - 6th',                  5, true,  false, 1,  14),
  -- Winning the trophy from second or third is not the same as topping the
  -- table, and the ladder credits alone would record the champion as runner-up.
  ('champion',                 'Competition',        'Win the championship play-off',               50, false, false, 1,  15),
  ('walkover',                 'Competition',        'Walkover - did not turn up',                 -30, true,  true,  null, 28),
  ('fixture_not_fulfilled',    'Competition',        'Failure to fulfil fixture',                  -40, false, true,  null, 29),
  ('match_abandoned',          'Competition',        'Match abandoned due to club',                -75, true,  true,  null, 34),

  -- Match administration
  ('team_sheet_on_time',       'Match Administration','Submit team sheet on time',                    5, true,  false, null, 16),
  ('match_report_on_time',     'Match Administration','Submit match report correctly and on time',    5, false, false, null, 17),
  ('team_sheet_late',          'Match Administration','Late team sheet',                             -5, true,  false, null, 30),
  ('team_sheet_missing',       'Match Administration','Failure to submit team sheet',               -15, true,  false, null, 31),

  -- Match operations. Awarded by default and deducted on report: an official
  -- running the clock cannot tick two boxes for six clubs every match day.
  ('equipment_setup',          'Match Operations',   'Set up Rugby League equipment',                5, true,  false, null, 18),
  ('equipment_teardown',       'Match Operations',   'Tear down and store equipment',                5, true,  false, null, 19),
  ('equipment_setup_failed',   'Match Operations',   'Failure to set up equipment',                -10, false, false, null, 32),
  ('equipment_teardown_failed','Match Operations',   'Failure to tear down or store equipment',    -10, false, false, null, 33),

  -- Discipline
  ('clean_discipline_match',   'Discipline',         'No cards in a match',                          2, true,  false, null, 20),
  ('yellow_card',              'Discipline',         'Yellow card',                                 -5, true,  false, null, 26),
  ('red_card',                 'Discipline',         'Red card',                                   -15, true,  true,  null, 27),

  -- Development. Capped: registering players is paperwork a club was going
  -- to do anyway, and uncapped it earns more than paying the dues.
  ('player_registered',        'Development',        'Register a player new to the federation',      5, true,  false, 15, 21),
  ('youth_developed',          'Development',        'Develop a youth player',                      10, false, false, 10, 22),
  ('female_developed',         'Development',        'Develop a female player',                     10, false, false, 10, 23),
  ('representative_player',    'Development',        'Provide a player to a representative side',   10, true,  false, 10, 24),
  ('coach_course',             'Development',        'Coach completes an approved RLFG course',     10, false, false, null, 25),
  ('community_activity',       'Development',        'Conduct approved school or community activity',10, false, false, null, 26)
on conflict (code) do update
  set area = excluded.area,
      label = excluded.label,
      -- Amounts already set by the federation are left alone on a re-run.
      automatic = excluded.automatic,
      requires_review = excluded.requires_review,
      sort_order = excluded.sort_order;

-- ── The ledger ──────────────────────────────────────────────
create table if not exists club_credits (
  entry_id    uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(team_id) on delete cascade,
  season      text not null,

  code        text references credit_rules(code),
  -- Copied, not looked up: what a red card cost in 2026 must stay what it
  -- cost in 2026, whatever the rule says later.
  amount      integer not null,
  description text not null,

  -- What it was for, where there is something to point at.
  fixture_id  uuid references fixtures(fixture_id) on delete set null,
  player_id   uuid references players(player_id) on delete set null,
  note        text,

  -- Null actor means the system worked it out rather than a person deciding.
  awarded_by  uuid,
  automatic   boolean not null default false,

  -- A rehearsal entry is shown and counted for display, and redeemed for
  -- nothing.
  shadow      boolean not null default false,

  -- Unspent credit does not accumulate for ever; the federation would be
  -- holding a debt it never agreed to.
  expires_on  date,

  created_at  timestamptz not null default now(),

  -- What stops an automatic sweep crediting the same thing twice. The writer
  -- sets it: 'fixture_fulfilled:<fixture_id>', 'league_position:2026'.
  dedupe_key  text
);

create unique index if not exists one_entry_per_thing
  on club_credits(team_id, dedupe_key) where dedupe_key is not null;

create index if not exists idx_club_credits_team_season on club_credits(team_id, season);
create index if not exists idx_club_credits_created on club_credits(created_at desc);

comment on table club_credits is
  'Every credit awarded or deducted. Never edited — a balance is the sum of these rows.';

-- ── The rehearsal ───────────────────────────────────────────
create table if not exists credit_settings (
  only_row         boolean primary key default true check (only_row),
  -- Seasons before this one are a rehearsal: calculated, shown, not redeemable.
  live_from_season text not null default '2027',
  -- How long a credit lasts. Two seasons is room to save for something without
  -- the federation carrying a debt for ever.
  expiry_seasons   integer not null default 2,
  updated_by       uuid,
  updated_at       timestamptz not null default now()
);

insert into credit_settings (only_row) values (true)
on conflict (only_row) do nothing;

-- ── Row level security ──────────────────────────────────────
-- Clubs read their own wallet through the portal's server actions, which use
-- the service key and check ownership. Nothing is written by a client.
alter table credit_rules enable row level security;
alter table club_credits enable row level security;
alter table credit_settings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'credit_rules' and policyname = 'public read credit rules') then
    create policy "public read credit rules" on credit_rules for select using (true);
  end if;
end $$;

-- ── Where it stands ─────────────────────────────────────────
select
  (select count(*) from credit_rules where active) as rules,
  (select count(*) from credit_rules where automatic and active) as automatic_rules,
  (select count(*) from club_credits) as ledger_entries,
  (select live_from_season from credit_settings) as live_from;
