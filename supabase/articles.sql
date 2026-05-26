-- ── articles ─────────────────────────────────────────────────────────────────
-- News articles written in the admin panel and served via the public API.

CREATE TABLE IF NOT EXISTS public.articles (
  article_id    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title         text        NOT NULL DEFAULT '',
  slug          text        UNIQUE,
  excerpt       text,
  content       text        NOT NULL DEFAULT '',   -- HTML from Tiptap
  cover_image_url text,
  status        text        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'published', 'archived')),
  author        text,
  tags          text[]      DEFAULT '{}',
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Updated-at trigger (reuse existing function if already created)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE TRIGGER articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS — public read of published articles; service-role writes
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read published articles"
  ON public.articles FOR SELECT
  USING (status = 'published');

-- Index for fast slug lookups and listing by published_at
CREATE INDEX IF NOT EXISTS articles_slug_idx       ON public.articles (slug);
CREATE INDEX IF NOT EXISTS articles_published_idx  ON public.articles (published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS articles_status_idx     ON public.articles (status);
