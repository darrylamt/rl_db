-- ============================================================
-- Remove duplicate player rows created by multiple import runs.
-- Keeps the earliest-inserted row per (team_id, first_name, last_name).
-- Cascade deletes also clean up duplicate player_registrations rows.
-- ============================================================

-- Preview how many duplicates exist before deleting
select first_name, last_name, count(*) as copies
from players
group by team_id, first_name, last_name
having count(*) > 1
order by first_name, last_name;

-- Delete duplicates (keep earliest created_at per name+team)
with ranked as (
  select
    player_id,
    row_number() over (
      partition by team_id, first_name, last_name
      order by created_at
    ) as rn
  from players
)
delete from players
where player_id in (
  select player_id from ranked where rn > 1
);

-- Confirm result
select t.name as team, count(*) as players
from players p
join teams t on t.team_id = p.team_id
group by t.name
order by t.name;
