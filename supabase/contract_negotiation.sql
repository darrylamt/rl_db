-- ============================================================
-- Contracts can be negotiated, and can carry the document itself.
--
-- An offer was take it or leave it: accept, or refuse and start again from
-- nothing. Real terms go back and forth, so a player can now counter, and
-- the club can accept that counter or counter it in turn.
--
-- The status says whose turn it is:
--
--   offered    the club has proposed; the player answers
--   countered  the player has proposed; the club answers
--
-- and either side may accept whatever is currently on the table. Every
-- version is kept in contract_proposals, so what was agreed can be read
-- against what was asked for months later — which is the only reason to
-- keep a negotiation rather than just its result.
--
-- The document is optional and private. A contract is between a club and a
-- player and has no business at a public URL, so the bucket is closed and
-- the file is served through a link that expires.
--
-- Run AFTER contracts_and_players.sql. Safe to re-run.
-- ============================================================

-- ── 1. Whose turn it is ─────────────────────────────────────
alter table contracts drop constraint if exists contracts_status_check;
alter table contracts
  add constraint contracts_status_check
  check (status in (
    'offered',     -- with the player
    'countered',   -- with the club
    'accepted',
    'declined',
    'withdrawn',
    'terminated'
  ));

-- ── 2. The negotiation itself ───────────────────────────────
create table if not exists contract_proposals (
  proposal_id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(contract_id) on delete cascade,

  -- Who put this version on the table.
  proposed_by text not null check (proposed_by in ('club', 'player')),

  starts_on   date not null,
  ends_on     date not null,
  terms       text,
  note        text,

  created_at  timestamptz not null default now()
);

create index if not exists idx_contract_proposals
  on contract_proposals(contract_id, created_at);

comment on table contract_proposals is
  'Every version of a contract that was put on the table, in order. The contract row carries the latest.';

-- Every contract already on record was offered once and never negotiated,
-- so its own terms are its first and only proposal.
insert into contract_proposals (contract_id, proposed_by, starts_on, ends_on, terms, created_at)
select c.contract_id, 'club', c.starts_on, c.ends_on, c.terms, c.offered_at
from contracts c
where not exists (
  select 1 from contract_proposals p where p.contract_id = c.contract_id
);

-- ── 3. The document ─────────────────────────────────────────
alter table contracts
  add column if not exists document_path        text,
  add column if not exists document_name        text,
  add column if not exists document_size        integer,
  add column if not exists document_uploaded_at timestamptz;

comment on column contracts.document_path is
  'Path inside the private contract-documents bucket. Never a public URL.';

-- A closed bucket, a small ceiling, and PDFs only.
--
-- Two megabytes is generous for a contract, which is text — anything larger
-- is a scan that should have been compressed, and at a few hundred contracts
-- a season the difference decides whether this fits in the free tier.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contract-documents', 'contract-documents', false, 2097152,
  array['application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 2097152,
      allowed_mime_types = array['application/pdf'];

-- No storage policies on purpose. Nothing reads or writes this bucket with
-- an anon key: the server uploads with the service role and hands out links
-- that expire, so a policy would only widen what can reach it.

alter table contract_proposals enable row level security;

-- ── Where things stand ──────────────────────────────────────
select
  (select count(*) from contracts where status = 'offered')   as with_a_player,
  (select count(*) from contracts where status = 'countered') as with_a_club,
  (select count(*) from contract_proposals)                   as proposals_on_record,
  (select count(*) from contracts where document_path is not null) as with_a_document;
