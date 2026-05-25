-- ── match_player_ratings ─────────────────────────────────────────────────────
-- Stores per-player match ratings (1.0 – 10.0).
-- Ratings can be set manually by admins; the UI also provides an auto-fill
-- value computed from the player's match_events for the fixture.

CREATE TABLE IF NOT EXISTS public.match_player_ratings (
  rating_id   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id  uuid        NOT NULL REFERENCES public.fixtures(fixture_id)  ON DELETE CASCADE,
  player_id   uuid        NOT NULL REFERENCES public.players(player_id)    ON DELETE CASCADE,
  team_id     uuid                 REFERENCES public.teams(team_id)        ON DELETE SET NULL,
  rating      numeric(3,1) NOT NULL CHECK (rating >= 1.0 AND rating <= 10.0),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fixture_id, player_id)
);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE TRIGGER match_player_ratings_updated_at
  BEFORE UPDATE ON public.match_player_ratings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS — public read, service-role writes (admin app uses service_role key)
ALTER TABLE public.match_player_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read match_player_ratings"
  ON public.match_player_ratings FOR SELECT USING (true);
