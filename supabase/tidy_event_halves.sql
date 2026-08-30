-- ============================================================
-- Make the half agree with the minute.
--
-- Optional. The timeline now orders on the minute and only uses the half to
-- separate two events sharing one, so nothing on the site depends on this.
-- It is worth running anyway: 180 events carry no half at all, and 7 carry
-- one that contradicts their own minute — a ninth-minute try marked as the
-- second half, because it was typed during the second half and the minute
-- was corrected afterwards while the half was not.
--
-- Rugby league is two halves of forty, so the minute settles it: anything
-- past 40 is the second half. Events with no minute are left alone — there
-- is nothing to derive a half from, and guessing would be worse than a null.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- What is about to change, before it changes.
select
  count(*) filter (where half is null and minute is not null)          as missing_half,
  count(*) filter (where minute <= 40 and half = 2)                    as marked_second_but_early,
  count(*) filter (where minute > 40  and half = 1)                    as marked_first_but_late,
  count(*) filter (where minute is null)                               as no_minute_left_alone
from match_events;

update match_events
set half = case when minute > 40 then 2 else 1 end
where minute is not null
  and half is distinct from (case when minute > 40 then 2 else 1 end);

-- And what it looks like afterwards.
select
  count(*)                                     as events,
  count(*) filter (where half is null)         as still_no_half,
  count(*) filter (where half = 1)             as first_half,
  count(*) filter (where half = 2)             as second_half
from match_events;
