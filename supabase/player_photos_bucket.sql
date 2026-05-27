-- ── player_photos_bucket ─────────────────────────────────────────────────────
-- Creates the public Supabase Storage bucket for permanent player photos.
-- Run once in the Supabase SQL editor.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'player-photos',
  'player-photos',
  true,
  5242880,   -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Authenticated users (admins) can upload
DROP POLICY IF EXISTS "Admins can upload player photos" ON storage.objects;
CREATE POLICY "Admins can upload player photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'player-photos');

-- Authenticated users can update/replace
DROP POLICY IF EXISTS "Admins can update player photos" ON storage.objects;
CREATE POLICY "Admins can update player photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'player-photos');

-- Authenticated users can delete
DROP POLICY IF EXISTS "Admins can delete player photos" ON storage.objects;
CREATE POLICY "Admins can delete player photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'player-photos');

-- Public read
DROP POLICY IF EXISTS "Anyone can view player photos" ON storage.objects;
CREATE POLICY "Anyone can view player photos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'player-photos');
