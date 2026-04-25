-- ============================================================
-- Fix storage buckets so uploaded images are publicly readable
-- Run in Supabase SQL editor
-- ============================================================

-- 1. Check current bucket state
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('team-logos', 'player-photos');

-- 2. Force buckets to be public (in case they were created as private)
update storage.buckets set public = true where id = 'team-logos';
update storage.buckets set public = true where id = 'player-photos';

-- 3. Recreate buckets if they don't exist
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('team-logos','team-logos',true,5242880,
  array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml'])
on conflict(id) do update set public=true;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('player-photos','player-photos',true,5242880,
  array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=true;

-- 4. Ensure public read policy exists (drop and recreate to be safe)
drop policy if exists "Public read team-logos"    on storage.objects;
drop policy if exists "Public read player-photos"  on storage.objects;
drop policy if exists "Authenticated insert team-logos"   on storage.objects;
drop policy if exists "Authenticated insert player-photos" on storage.objects;
drop policy if exists "Authenticated update team-logos"   on storage.objects;
drop policy if exists "Authenticated update player-photos" on storage.objects;
drop policy if exists "Authenticated delete team-logos"   on storage.objects;
drop policy if exists "Authenticated delete player-photos" on storage.objects;

-- Public read (no auth required — makes images load in browser)
create policy "Public read team-logos"
  on storage.objects for select using (bucket_id = 'team-logos');
create policy "Public read player-photos"
  on storage.objects for select using (bucket_id = 'player-photos');

-- Allow all inserts/updates/deletes (service role bypasses anyway)
create policy "Allow all team-logos writes"
  on storage.objects for insert with check (bucket_id = 'team-logos');
create policy "Allow all player-photos writes"
  on storage.objects for insert with check (bucket_id = 'player-photos');

-- 5. Verify
select id, name, public from storage.buckets where id in ('team-logos','player-photos');
select count(*) as objects_in_storage from storage.objects
where bucket_id in ('team-logos','player-photos');
