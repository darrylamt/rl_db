-- ============================================================
-- Kicking, as an attribute in its own right.
--
-- The five scouted attributes had no place for it, so a goal kicker and a
-- forward who has never taken one scored the same on paper. In rugby league
-- kicking decides matches — goal kicking, the kick to touch, the 40/20 — and
-- it is the one attribute already measurable here: conversion rate is on
-- record for every player who has taken a kick.
--
-- The view is rebuilt rather than replaced, because a column cannot be added
-- mid-list. It is recreated exactly as it stood, plus the new column: same
-- columns, same order, same security_invoker, same coalesced rating.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

alter table players
  add column if not exists attr_kicking smallint;

drop view if exists public.public_players;

create view public.public_players
  with (security_invoker = true)
as
select
  player_id,
  team_id,
  first_name,
  last_name,
  date_of_birth,
  case when date_of_birth is null then null
       else extract(year from age(date_of_birth))::integer
  end as age,
  height_cm,
  weight_kg,
  nationality,
  jersey_number,
  position,
  is_captain,
  playing_status,
  photo_url,
  coalesce(rating, 6.0) as rating,
  attr_strength,
  attr_speed,
  attr_iq,
  attr_defense,
  attr_ability,
  attr_kicking,
  created_at
from public.players;
