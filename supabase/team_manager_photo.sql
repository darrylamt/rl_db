-- ----------------------------------------------------------------------
-- A photo of the team manager.
--
-- The manager was a name and nothing else, so the website's manager card
-- showed initials where the coach and captain showed faces. This is the
-- picture, uploaded from the admin team form. Safe to run more than once.
-- ----------------------------------------------------------------------

alter table teams
  add column if not exists manager_photo_url text;

comment on column teams.manager_photo_url is
  'Photo of the team manager, uploaded from the admin team form. Null shows initials.';
