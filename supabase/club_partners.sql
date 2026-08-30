-- ============================================================
-- A partner can belong to a club, not only to the federation.
--
-- partners held sponsors of the federation and nothing else, so a club's own
-- backers had nowhere to live. Clubs have their own sponsors and they belong
-- on the club's profile.
--
-- One nullable column carries it: null means the federation's partner, which
-- is what every existing row is, and a team_id means that club's. Nothing
-- already recorded changes meaning.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

alter table partners
  add column if not exists team_id uuid references teams(team_id) on delete cascade;

create index if not exists idx_partners_team on partners(team_id);

comment on column partners.team_id is
  'The club this partner backs. Null for a federation-wide partner.';
