-- ============================================================
-- LeagueX gets an extra nought.
--
-- Values were set on a scale where a good player was worth about a hundred
-- and a season's budget six hundred. The numbers were right in proportion
-- and wrong in feel: a currency reads as small change at two digits, and a
-- transfer fee is not small change.
--
-- Everything is multiplied by ten. Nothing about the model changes — every
-- ratio, every ranking and every relative price is exactly as it was — but a
-- median player now costs around 840 LX rather than 84, and a club's season
-- budget is in the thousands.
--
-- WHAT THIS TOUCHES
--   Only the allocations already granted for 2026, which were written on the
--   old scale. Player and club values are worked out from constants in the
--   code on every page load, so those moved with the deploy and need nothing
--   doing to them here. No transfer has been quoted or settled yet, so there
--   is no fee, levy or adjustment in the ledger to think about.
--
-- WHY THE GUARD IS WHAT IT IS
--   Running this twice would leave every club with a hundred times the
--   intended budget, so it only touches allocations still small enough to be
--   on the old scale. The largest the old scale could grant is 950 and the
--   smallest the new scale can is 3,000, so the two cannot be confused.
--
--   It is deliberately restricted to allocations. A levy on the new scale is
--   a two or three figure number quite legitimately, and a fee for a
--   bottom-of-the-range player is 460 — so a guard written on size alone
--   would corrupt exactly the rows it was meant to leave alone.
--
-- Run once in the Supabase SQL editor. Safe to re-run — it does nothing the
-- second time.
-- ============================================================

-- What is about to change, on the screen before it changes.
select
  coalesce(t.name, 'FEDERATION') as club,
  l.season,
  l.amount                       as before_this_runs,
  l.amount * 10                  as after_this_runs
from lx_ledger l
left join teams t on t.team_id = l.team_id
where l.kind = 'allocation'
  and l.amount < 3000
order by t.name;

update lx_ledger
set    amount = amount * 10,
       note   = coalesce(note, '') || ' Rescaled ten-fold when LeagueX gained a digit.'
where  kind = 'allocation'
  and  amount < 3000;

-- ── What is on record now ───────────────────────────────────
-- Every club should read as a four-figure number.
select
  coalesce(t.name, 'FEDERATION') as holder,
  sum(l.amount)                  as balance,
  count(*)                       as entries
from lx_ledger l
left join teams t on t.team_id = l.team_id
group by t.name
order by balance desc;
