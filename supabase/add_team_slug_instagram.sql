ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS instagram_url text;

-- Unique index so slugs stay distinct
CREATE UNIQUE INDEX IF NOT EXISTS teams_slug_key ON public.teams (slug)
  WHERE slug IS NOT NULL;
