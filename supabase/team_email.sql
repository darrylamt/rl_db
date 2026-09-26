-- ----------------------------------------------------------------------
-- A club's contact email.
--
-- Set on the admin team form and shown on the club's page on the website,
-- so people can reach a club. Public by design: only put an address here
-- that the club wants published. Safe to run more than once.
-- ----------------------------------------------------------------------

alter table teams
  add column if not exists email text;

comment on column teams.email is
  'Public contact email for the club, shown on its website page. Null hides it.';
