-- ============================================================
-- Security fixes — run via: supabase db execute or SQL editor
-- ============================================================

-- 1. Fix standings view: switch from SECURITY DEFINER to SECURITY INVOKER
--    so RLS is respected for the querying user, not the view owner.
ALTER VIEW public.standings SET (security_invoker = true);

-- 2. Drop overly-permissive write policies on fixtures.
--    The admin app uses the service_role key which bypasses RLS anyway,
--    so these "always true" INSERT/UPDATE policies are not needed and
--    currently allow anyone with the anon key to write directly.
DROP POLICY IF EXISTS "public insert fixtures" ON public.fixtures;
DROP POLICY IF EXISTS "public update fixtures" ON public.fixtures;

-- 3. Drop overly-permissive write policies on match_events.
DROP POLICY IF EXISTS "public insert match_events" ON public.match_events;

-- 4. Drop overly-permissive write policies on match_results.
DROP POLICY IF EXISTS "public insert match_results" ON public.match_results;
DROP POLICY IF EXISTS "public update match_results" ON public.match_results;

-- 5. Remove broad SELECT policies on storage.objects that expose bucket
--    directory listings. Public bucket CDN URLs still work without these.
DROP POLICY IF EXISTS "Public read player-photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read team-logos"    ON storage.objects;
