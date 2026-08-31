-- ============================================================
-- A club can re-sign a player before their contract runs out.
--
-- The rule was one live contract or open offer per club per player, which
-- meant a club could not offer terms to somebody it already had. The only
-- way to keep a player was to wait for the contract to lapse — at which
-- point they are out of contract and anybody can talk to them. Exactly the
-- wrong moment to start negotiating.
--
-- So an offer may now sit alongside a running contract. Two things still
-- hold, and they are what the index below is for:
--
--   one open offer per club per player  -- asking twice is not asking harder
--   one accepted contract per club      -- a player is signed once, not twice
--
-- When a renewal may be offered, and that it cannot overlap the contract it
-- follows, is enforced in the code that writes it: those are rules about
-- dates and a month's notice, and a unique index cannot express them.
--
-- Run AFTER contracts_and_players.sql. Safe to re-run.
-- ============================================================

drop index if exists one_live_contract_per_club_per_player;

-- One offer on the table at a time.
create unique index if not exists one_open_offer_per_club_per_player
  on contracts(player_id, team_id)
  where status = 'offered';

-- And one running contract. A renewal becomes accepted only when the player
-- takes it, so this is checked at that moment rather than at the offer.
create unique index if not exists one_accepted_contract_per_club_per_player
  on contracts(player_id, team_id)
  where status = 'accepted';

-- ── Who could be re-signed today ────────────────────────────
select
  t.name as club,
  count(*) filter (
    where c.ends_on <= (current_date + interval '1 month')::date
  ) as inside_the_last_month,
  count(*) as contracts_running
from contracts c
join teams t on t.team_id = c.team_id
where c.status = 'accepted'
  and c.ends_on >= current_date
group by t.name
order by t.name;
