-- ----------------------------------------------------------------------
-- A club's colour, where reading it off the crest gets it wrong.
--
-- The poll bars take their colour from the badge, which works for most
-- clubs. It is a guess though, and a guess about a badge somebody designed
-- is one they are entitled to overrule — so this is the override, and it
-- wins whenever it is set.
--
-- Any CSS colour is valid here; the admin team form offers a picker.
-- ----------------------------------------------------------------------

alter table teams
  add column if not exists brand_color text;

comment on column teams.brand_color is
  'Overrides the colour read from the crest, for poll bars and anywhere else a club needs one. Any CSS colour; null means work it out from the badge.';

-- Dragons reads as something other than red off its crest, and red is what
-- the club actually is.
update teams set brand_color = '#dc2626' where name = 'Dragons';
