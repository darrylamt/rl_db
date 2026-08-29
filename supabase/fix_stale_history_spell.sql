-- ============================================================
-- Remove a spell the evidence no longer supports.
--
-- An earlier run of player_history_seed.sql recorded Darryl Amoatey at Bulls
-- for 2025, on the strength of a single line-up row that also had him in the
-- Panthers squad for the same match. That row has since been removed by
-- fix_lineup_both_squads.sql, and the seed no longer produces the spell.
--
-- The seed only ever inserts, so it could not take the spell back out. Left
-- alone it reads as a transfer to Bulls in 2025 and a return to Panthers,
-- neither of which happened — he was at Panthers until 2026.
--
-- Only removes it while no line-up or event ties him to Bulls that season,
-- so it cannot delete a spell that is genuinely evidenced.
-- ============================================================

delete from player_history h
using players p, teams t
where h.player_id = p.player_id
  and h.team_id = t.team_id
  and p.first_name = 'Darryl' and p.last_name = 'Amoatey'
  and t.name = 'Bulls'
  and h.season = '2025'
  and not exists (
    select 1 from match_lineups l
    join fixtures f on f.fixture_id = l.fixture_id
    where l.player_id = p.player_id and l.team_id = t.team_id
      and extract(year from f.scheduled_date) = 2025
  )
  and not exists (
    select 1 from match_events e
    join fixtures f on f.fixture_id = e.fixture_id
    where e.player_id = p.player_id and e.team_id = t.team_id
      and extract(year from f.scheduled_date) = 2025
  );
