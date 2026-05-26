-- ── add_video_url ────────────────────────────────────────────────────────────
-- Adds a video_url column to match_results for linking YouTube highlights.
-- Run once in the Supabase SQL editor.

ALTER TABLE public.match_results
  ADD COLUMN IF NOT EXISTS video_url text;
