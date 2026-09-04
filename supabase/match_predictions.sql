-- ----------------------------------------------------------------------
-- "Who will win?" — an anonymous fan poll on the next match.
--
-- There is no fan login on this site, so a vote is tied to a random id a
-- browser makes up for itself and keeps in localStorage — soft protection
-- against voting twice, appropriate for a fun poll rather than something
-- that needs to be airtight. Changing your mind re-votes rather than fails,
-- via the unique pair below plus an upsert on the write side.
-- ----------------------------------------------------------------------

create table if not exists match_predictions (
  prediction_id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references fixtures(fixture_id) on delete cascade,
  device_id uuid not null,
  choice text not null check (choice in ('home', 'away')),
  created_at timestamptz not null default now(),
  unique (fixture_id, device_id)
);

create index if not exists match_predictions_fixture_idx
  on match_predictions (fixture_id);

-- Enabled with no anon policies at all, the same as every other table added
-- this build: a vote is written by a server action using the service role,
-- never directly from the browser with the anon key.
alter table match_predictions enable row level security;
