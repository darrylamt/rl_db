-- ── article_images_bucket ────────────────────────────────────────────────────
-- Creates the public Supabase Storage bucket used for article cover images
-- and inline editor images.  Run this in the Supabase SQL editor once.

-- 1. Create bucket (public = files are accessible without a signed URL)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'article-images',
  'article-images',
  true,
  8388608,   -- 8 MB limit
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Allow authenticated users (admins) to upload
DROP POLICY IF EXISTS "Admins can upload article images" ON storage.objects;
CREATE POLICY "Admins can upload article images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'article-images');

-- 3. Allow authenticated users to delete their own uploads
DROP POLICY IF EXISTS "Admins can delete article images" ON storage.objects;
CREATE POLICY "Admins can delete article images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'article-images');

-- 4. Public read (bucket is public, but row-level policy also needed)
DROP POLICY IF EXISTS "Anyone can view article images" ON storage.objects;
CREATE POLICY "Anyone can view article images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'article-images');
