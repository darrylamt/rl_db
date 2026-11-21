-- ============================================================
-- Accepting a renewal.
--
-- contract_renewals.sql allowed one accepted contract per club per player.
-- But a renewal is accepted while the contract it follows is still running,
-- so the player taking it hit "one_accepted_contract_per_club_per_player"
-- and could not re-sign. Old contracts also stay 'accepted' after they end,
-- so even a later renewal would have hit it.
--
-- What has to hold is narrower: a player cannot be signed to the same club
-- twice for the same days. So accepted contracts may sit side by side as
-- long as their dates do not overlap.
--
-- Run AFTER contract_renewals.sql. Safe to re-run.
-- ============================================================

create extension if not exists btree_gist;

drop index if exists one_accepted_contract_per_club_per_player;

alter table contracts drop constraint if exists no_overlapping_accepted_contracts;
alter table contracts
  add constraint no_overlapping_accepted_contracts
  exclude using gist (
    player_id with =,
    team_id with =,
    daterange(starts_on, ends_on, '[]') with &&
  )
  where (status = 'accepted');
