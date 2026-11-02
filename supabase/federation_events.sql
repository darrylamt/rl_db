-- ----------------------------------------------------------------------
-- RLFG events: tournaments, clinics, AGMs, launches, socials.
--
-- Kept in the admin under Public site > Events and shown on the website's
-- Events page, with the next few on its homepage. Separate from
-- match_events, which are tries and goals inside a match.
--
-- Safe to run more than once.
-- ----------------------------------------------------------------------

create table if not exists public.federation_events (
  event_id    uuid primary key default gen_random_uuid(),
  title       text not null,
  -- tournament | clinic | meeting | launch | social | other
  category    text not null default 'other',
  starts_on   date not null,
  start_time  time,
  -- For events that run over several days. Null means one day.
  ends_on     date,
  venue       text,
  summary     text,
  details     text,
  image_url   text,
  -- Where to register, buy tickets or read more.
  link        text,
  -- draft (admin only) | published | cancelled (shown, marked cancelled)
  status      text not null default 'published'
              check (status in ('draft', 'published', 'cancelled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists federation_events_starts_idx
  on public.federation_events (starts_on);

-- The website reads published and cancelled events; drafts stay in the
-- admin. Writes go through the server with the service key.
alter table public.federation_events enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'federation_events' and policyname = 'Public read federation_events') then
    create policy "Public read federation_events" on public.federation_events
      for select using (status <> 'draft');
  end if;
end $$;
