-- ============================================================
-- Storage for the content tables.
--
-- Two buckets rather than one so the allowed types stay meaningful: images
-- have a small size limit, documents need a much larger one and admit PDFs
-- and Office files.
--
-- Both are public. Admin writes go through the service role key, which
-- bypasses storage RLS, and public bucket CDN URLs are readable without a
-- select policy — the same arrangement security-fixes.sql settled on for
-- team-logos and player-photos.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- Thumbnails, partner logos, board and committee photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-images', 'content-images', true, 5242880,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'
  ]
) on conflict (id) do nothing;

-- Reports, AGM minutes, policies — 25 MB ceiling
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', true, 26214400,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png'
  ]
) on conflict (id) do nothing;

-- If either bucket already existed with tighter settings, widen it to match.
update storage.buckets
set public = true,
    file_size_limit = 5242880
where id = 'content-images';

update storage.buckets
set public = true,
    file_size_limit = 26214400
where id = 'documents';
