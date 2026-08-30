-- ============================================================
-- A player a club adds waits for the federation.
--
-- The club portal exists so squads get filled in by the people who know
-- them. But a club adding a player is a claim, not a fact: the federation
-- decides who is on the register, and until now a club could type anyone
-- straight into it.
--
-- So a club's new player arrives pending. They belong to the club, the club
-- can see and finish their details, and nothing public shows them until the
-- federation approves. Declining keeps the row and the reason rather than
-- deleting it — a club that has been turned down should be able to see that
-- they were, and why.
--
-- Every player already on the register is approved by this running. Nobody
-- disappears from the site.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

alter table players
  add column if not exists approval_status text not null default 'approved',
  add column if not exists submitted_by    uuid,
  add column if not exists submitted_at    timestamptz,
  add column if not exists reviewed_by     uuid,
  add column if not exists reviewed_at     timestamptz,
  add column if not exists review_note     text;

alter table players drop constraint if exists players_approval_status_check;
alter table players
  add constraint players_approval_status_check
  check (approval_status in ('pending', 'approved', 'declined'));

comment on column players.approval_status is
  'approved is the norm. pending is a club submission awaiting the federation; declined keeps the record and the reason.';
comment on column players.review_note is
  'Why a submission was declined, shown back to the club that made it.';

create index if not exists idx_players_approval
  on players(approval_status) where approval_status <> 'approved';

-- ── The public register is the approved one ─────────────────
-- public_players is what /api/players serves, so filtering here keeps a
-- pending submission off the website without every caller remembering to
-- ask. The column list is carried over exactly as it was — the computed age,
-- the rating default and security_invoker all matter and none of them
-- survive a "select *".
drop view if exists public.public_players;

create view public.public_players
  with (security_invoker = true)
as
select
  player_id,
  team_id,
  first_name,
  last_name,
  date_of_birth,
  case when date_of_birth is null then null
       else extract(year from age(date_of_birth))::integer
  end as age,
  height_cm,
  weight_kg,
  nationality,
  jersey_number,
  position,
  is_captain,
  playing_status,
  photo_url,
  coalesce(rating, 6.0) as rating,
  attr_strength,
  attr_speed,
  attr_iq,
  attr_defense,
  attr_ability,
  attr_kicking,
  created_at
from public.players
where approval_status = 'approved';

-- ── What is waiting ─────────────────────────────────────────
select approval_status, count(*) as players
from players
group by approval_status
order by approval_status;
