-- ============================================================
-- Article content: preserved blocks + category.
--
-- The website renders a typed blocks[] array. Some of its block types —
-- gallery, attributed quote, spacer, button-style link — cannot be
-- expressed in the Tiptap HTML the admin editor produces, so importing the
-- archive as HTML alone would flatten them.
--
-- `blocks` keeps the original array verbatim and is what the API serves
-- when it is present. `content` still holds an HTML rendering so the
-- article is editable in the admin; saving there takes ownership and
-- clears `blocks`.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

alter table articles
  add column if not exists blocks   jsonb,
  add column if not exists category text;

-- The site shows this as a badge on news cards.
create index if not exists articles_category_idx on articles (category);
