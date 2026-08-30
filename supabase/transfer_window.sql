-- ============================================================
-- When clubs may approach each other.
--
-- Transfers were open permanently, which is nobody's rule. A federation
-- decides when the market runs, and that decision has to hold whether or not
-- anyone is watching the admin at the time.
--
-- Two mechanisms, because each covers what the other cannot.
--
-- Windows are the plan: dates set in advance, so the market opens and closes
-- on its own at the start of a season without anybody being reminded.
--
-- The switch is the exception: a window that has to shut early, or a day
-- opened for a case that could not wait. It overrides the dates while it is
-- set, and handing control back to the dates is one move rather than an
-- edit to them.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- ── The dates ───────────────────────────────────────────────
create table if not exists transfer_windows (
  window_id  uuid primary key default gen_random_uuid(),
  name       text not null,
  opens_on   date not null,
  closes_on  date not null,
  season     text,
  created_at timestamptz not null default now(),

  constraint a_window_must_end_after_it_starts check (closes_on >= opens_on)
);

create index if not exists idx_transfer_windows_dates
  on transfer_windows(opens_on, closes_on);

comment on table transfer_windows is
  'Dates the market runs between. Any window covering today opens it.';

-- ── The switch ──────────────────────────────────────────────
-- One row, ever. The check on a constant column is what keeps it that way:
-- a second insert collides on the primary key.
create table if not exists transfer_settings (
  only_row   boolean primary key default true check (only_row),

  -- follow  the windows above decide
  -- open    open regardless of them
  -- closed  shut regardless of them
  mode       text not null default 'follow'
             check (mode in ('follow', 'open', 'closed')),

  note       text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

insert into transfer_settings (only_row, mode)
values (true, 'follow')
on conflict (only_row) do nothing;

comment on column transfer_settings.mode is
  'follow the windows, or override them open or closed until set back to follow.';

-- ── Row level security ──────────────────────────────────────
-- The admin writes both with the service key. Reading the state is harmless
-- and useful — a club is told why the market is shut — so both are readable.
alter table transfer_windows enable row level security;
alter table transfer_settings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'transfer_windows' and policyname = 'public read transfer windows') then
    create policy "public read transfer windows" on transfer_windows for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'transfer_settings' and policyname = 'public read transfer settings') then
    create policy "public read transfer settings" on transfer_settings for select using (true);
  end if;
end $$;

-- ── Where it stands ─────────────────────────────────────────
select
  s.mode,
  (select count(*) from transfer_windows w
    where current_date between w.opens_on and w.closes_on) as windows_covering_today,
  case
    when s.mode = 'open' then 'OPEN — switched on, ignoring the dates'
    when s.mode = 'closed' then 'CLOSED — switched off, ignoring the dates'
    when exists (select 1 from transfer_windows w
                  where current_date between w.opens_on and w.closes_on)
      then 'OPEN — a window covers today'
    else 'CLOSED — no window covers today'
  end as right_now
from transfer_settings s;
