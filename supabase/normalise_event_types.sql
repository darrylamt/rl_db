-- ============================================================
-- One spelling per event type.
--
-- match_events had the same thing written more than one way —
-- 'penalty goal' alongside 'penalty_goal', 'yellow card' alongside
-- 'yellow_card' — because events have been entered from three different
-- screens over time. Anything comparing event_type to a fixed string
-- silently missed the odd spellings.
--
-- Lowercases and turns runs of whitespace into single underscores, which
-- makes every existing variant collapse onto the canonical form.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

update match_events
set event_type = regexp_replace(lower(trim(event_type)), '\s+', '_', 'g')
where event_type is not null
  and event_type <> regexp_replace(lower(trim(event_type)), '\s+', '_', 'g');

-- 'penalty' and 'penalty_goal' are the same act; /enter/events writes the
-- short form, the admin result editor writes the long one.
update match_events set event_type = 'penalty_goal' where event_type = 'penalty';
