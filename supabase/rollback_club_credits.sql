-- ============================================================
-- Undo the Club Credit System.
--
-- Removes the three tables club_credits.sql created and nothing else. The
-- credit system only ever wrote to its own tables — the sweep read fixtures,
-- events, team sheets and players but changed none of them — so this puts
-- the database back exactly as it was before.
--
-- WHAT THIS DELETES
--   credit_rules      the 41 seeded regulations
--   club_credits      every ledger entry, including the 1,254 the sweep wrote
--   credit_settings   the rehearsal setting
--
-- Nothing outside those three is touched. No fixture, result, player, team
-- sheet or transfer is affected.
--
-- The work is not lost. It is in the repository's history at commit
-- c02546b, and can be brought back with the code if this is ever revisited.
--
-- Run once in the Supabase SQL editor.
-- ============================================================

-- What is about to go, so it is on the screen before it goes.
select
  (select count(*) from credit_rules)    as rules_to_delete,
  (select count(*) from club_credits)    as ledger_entries_to_delete,
  (select count(*) from credit_settings) as settings_to_delete;

-- club_credits references credit_rules, so it goes first. No other table
-- references any of these, which is why no cascade is needed and why nothing
-- else can be caught by this.
drop table if exists club_credits;
drop table if exists credit_rules;
drop table if exists credit_settings;

-- Confirms they are gone; each should come back false.
select
  to_regclass('public.club_credits')    is not null as club_credits_still_there,
  to_regclass('public.credit_rules')    is not null as credit_rules_still_there,
  to_regclass('public.credit_settings') is not null as credit_settings_still_there;
