-- Match sheets: the scanned team sheet and scoring record behind a result.
--
-- The old website linked each match to a photo or scan of its sheet, kept in
-- Google Drive, so a result could be checked against what was written on the
-- day. That link lived only in the website's bundled schedule file and was
-- lost when the site moved to this database. This gives it a home again, lets
-- admins and recorders upload new ones, and puts the old links back.
--
-- Safe to run more than once.

create table if not exists public.fixture_documents (
  document_id uuid primary key default gen_random_uuid(),
  fixture_id  uuid not null references public.fixtures(fixture_id) on delete cascade,
  -- team_sheet | events | other
  kind        text not null default 'other'
              check (kind in ('team_sheet', 'events', 'other')),
  url         text not null,
  note        text,
  uploaded_by text,
  created_at  timestamptz not null default now(),
  unique (fixture_id, url)
);

create index if not exists fixture_documents_fixture_idx
  on public.fixture_documents (fixture_id);

-- Match sheets have always been public on the website. Anyone may read them;
-- only the server (service key) writes.
alter table public.fixture_documents enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'fixture_documents' and policyname = 'Public read fixture_documents') then
    create policy "Public read fixture_documents" on public.fixture_documents
      for select using (true);
  end if;
end $$;

-- Where uploads go. Photos from a phone and scanned PDFs, up to 15 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('match-sheets', 'match-sheets', true, 15728640,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage'
                 and tablename = 'objects' and policyname = 'Public read match-sheets') then
    create policy "Public read match-sheets" on storage.objects
      for select using (bucket_id = 'match-sheets');
  end if;
end $$;

-- The old website's links, matched to their fixtures by date, both clubs and,
-- where two sides met twice on one day, the competition. 126 of the
-- 132 matched exactly one fixture. The six that did not (four youth girls'
-- matches not in the database, and two dated 7 June 2026 that the database
-- has on 14 June) are left to be attached by hand rather than guessed.
insert into public.fixture_documents (fixture_id, kind, url, note, uploaded_by)
select v.fixture_id, 'other', v.url, 'Match sheet from the old website', 'import'
from (values
  ('5fd8311e-9bfd-499d-a4d3-1241723638f2'::uuid, 'https://drive.google.com/file/d/1Ve9LXUV-cCMPyEKpSmpfsGzKSJKBHvlK/view?usp=sharing'),
  ('bf07eed9-cd75-40f6-9149-9d1e9d542673'::uuid, 'https://drive.google.com/file/d/1aQfM7fAuN4mccKxcKpO_IXWPbBDU040E/view?usp=sharing'),
  ('2fa292cc-4426-4b69-8c89-fa244921fec6'::uuid, 'https://drive.google.com/file/d/1OnzcoR-ncnUNlT2EX-0msT-EmKgOzS-9/view?usp=sharing'),
  ('9f944c18-af45-4640-b496-65814c7eb1a8'::uuid, 'https://drive.google.com/file/d/19SQ2qYaT2VOURspKhPY_PFpHtHM-4fw7/view?usp=sharing'),
  ('e20022ea-8301-4293-a18f-14dda98a3832'::uuid, 'https://drive.google.com/file/d/1zBMTPb9x7x3UKrIjruj1pZuSb-XVWpwr/view?usp=sharing'),
  ('2020b6b2-52c1-4c19-96c7-daac1129d034'::uuid, 'https://drive.google.com/file/d/1Heztg5rBJI45ZoSljaDnttne0QBdDnpG/view?usp=sharing'),
  ('60560c40-3d75-4540-926e-7d6ead7d1103'::uuid, 'https://drive.google.com/file/d/1coD0hrgxLn1xuLScPK1MW_9482-C1v4I/view?usp=sharing'),
  ('d298a460-6b9a-4d93-83e3-31184dd97e71'::uuid, 'https://drive.google.com/file/d/1ytFT6Eu764-MQGNWhsKFUO_BLqQJhxvI/view?usp=sharing'),
  ('7a6b28fc-7f81-4762-884b-13e88941d1bb'::uuid, 'https://drive.google.com/file/d/19Nb4Kl-sg5v35CgJ7yZmIUYK8yI6aKHZ/view?usp=sharing'),
  ('ae73c23e-7f35-4a63-97d5-d076adb30573'::uuid, 'https://drive.google.com/file/d/1pHofmghjM2J-ggyfX_fwh1yCTmt22YGQ/view?usp=sharing'),
  ('166bdb03-5632-4aea-98db-cc8e0795242f'::uuid, 'https://drive.google.com/file/d/1D4GPKS3CcPdHweRCfnvgHlUvz7wwJ4bS/view?usp=sharing'),
  ('8a7c29ac-925d-4f15-a5eb-b2dc97ab5697'::uuid, 'https://drive.google.com/file/d/1LUoZJYLEX7ZUKZYSSJvhc2w1BaYBP8ae/view?usp=sharing'),
  ('ed3d5497-3ebb-42a7-a1f9-937ce553c611'::uuid, 'https://drive.google.com/file/d/1nzvKZ6avOfFPJrQy8nUrEak1eOG3lB1z/view?usp=sharing'),
  ('64ce77b8-2a3e-4ec2-bdc0-4a7f101c795f'::uuid, 'https://drive.google.com/file/d/1PvwREZbMujBzGa0uLgmpPm1CQi__4e8q/view?usp=sharing'),
  ('aa2a448d-1c34-4600-91ee-8fdcc2427d89'::uuid, 'https://drive.google.com/file/d/1Kd55rYsRzKMJlQ70HQEkcGRmwEtyvWc7/view?usp=sharing'),
  ('fb7bfad8-fc3d-4d0b-bf03-16bad4d0e18d'::uuid, 'https://drive.google.com/file/d/1aQfM7fAuN4mccKxcKpO_IXWPbBDU040E/view?usp=sharing'),
  ('8bd08595-3f51-42df-99bd-72d110acafcc'::uuid, 'https://drive.google.com/file/d/14cYNdY7_W17FDJM1x6MgNgRUcWkmH6Bi/view?usp=sharing'),
  ('9fb1865d-2498-4a90-95e1-20b65843fc9f'::uuid, 'https://drive.google.com/file/d/1cGoUDcBa9XM6xLpqoh6NQnfBKoimHQ73/view?usp=sharing'),
  ('ad631c9c-6dbb-4eb9-81ae-03a6cac7fd29'::uuid, 'https://drive.google.com/file/d/1rkRnz3Sb5if_6zFuStN5CxX9sZCCqdpz/view?usp=sharing'),
  ('7470e9a0-4e0f-4209-b26d-89190be074e3'::uuid, 'https://drive.google.com/file/d/1XQgD9YycfodEv9VHPKx3gclZ68qvSjhp/view?usp=sharing'),
  ('852d017b-3efb-449d-be5c-23c5faea51ef'::uuid, 'https://drive.google.com/file/d/11NNCa8kqsPOZeV_n8soBKsnG9aM2GOT8/view?usp=sharing'),
  ('9398d4c3-553c-4585-92ca-853ff7e62eb2'::uuid, 'https://drive.google.com/file/d/1773xz8mqiupCXsl4ElMRxtFXo3ZANcku/view?usp=sharing'),
  ('96d70d9e-9874-4b20-8ca6-cea17242ff5a'::uuid, 'https://drive.google.com/file/d/1nB79KVFKxLnE2ABGIUIkItWVs-LD_zp1/view?usp=sharing'),
  ('9be4e5d7-721d-4a5b-90df-0ff342e68e97'::uuid, 'https://drive.google.com/file/d/1FPmRasNjb4ARIdt5EU0dy5ykNF3ty89x/view?usp=sharing'),
  ('404e4a55-f7cb-49a5-ae15-f2f50e0cf473'::uuid, 'https://drive.google.com/file/d/1kxLwojgk6_Pxq2xx4gyifRM6XMRYtehS/view?usp=sharing'),
  ('befc6d47-2fc3-4199-9e97-5be6e6a0ecdd'::uuid, 'https://drive.google.com/file/d/1GkepnhrZ8NcH-JGj2mrD6XzExJCchxPx/view?usp=sharing'),
  ('2462c472-d59d-423a-a0b6-22ac38b18716'::uuid, 'https://drive.google.com/file/d/1pijwSB9nNHNAG1RD2Rv6yBNqMW0AlDfW/view?usp=sharing'),
  ('8b142525-31ad-4a29-8ac8-9b7a9cce2959'::uuid, 'https://drive.google.com/file/d/186QQwr9kDxj_8Sy5YWc0X223uDe2LrWf/view?usp=sharing'),
  ('7479bbe3-2640-4ed6-8e1c-b2d169b4538f'::uuid, 'https://drive.google.com/file/d/1LwlxBfycB2wsORcXZUU34-H1C3x-dtVn/view?usp=sharing'),
  ('cac1864f-a2d9-4ad8-9200-7e2670c0d33a'::uuid, 'https://drive.google.com/file/d/1paO5BSbVbXM2W9628SIEnFFZPl-AKVWA/view?usp=sharing'),
  ('3dd7053f-d7d2-4012-96d7-1269c05c1276'::uuid, 'https://drive.google.com/file/d/1xZSCkQrSnY4ActBrrkAzIYUZNmkKjQ2a/view?usp=sharing'),
  ('f5ee3ceb-5b17-4898-9ba0-fc6a5be3c012'::uuid, 'https://drive.google.com/file/d/1Nf1xNKGn1GhbEMaAOf4NAOgVE4JEtz0R/view?usp=sharing'),
  ('48d295d4-02f9-40ec-9367-7ddd498d47ed'::uuid, 'https://drive.google.com/file/d/1nA35aFiVuCI9RYwI2Y7t7zhC7FDQg3xA/view?usp=sharing'),
  ('fa7e3144-a2a2-439e-928b-a966214161b7'::uuid, 'https://drive.google.com/file/d/1yzQpa_g_jTls6gH6K45sjtQj6C90fDWH/view?usp=sharing'),
  ('8b625413-06d0-474d-bf2f-51673fd8b45c'::uuid, 'https://drive.google.com/file/d/1m20g1Vp2vlzJX89AM_XmABJxLpsgtZtY/view?usp=sharing'),
  ('b0f78c12-25c8-4f7a-84d4-fbbf945f2f5e'::uuid, 'https://drive.google.com/file/d/1zOh7S6JdKOvzBvn7fQsCoTB8JgnJfQNd/view?usp=sharing'),
  ('f3288d09-2d63-47e4-bcb6-671561e3a2ff'::uuid, 'https://drive.google.com/file/d/1NtJn7nTy9EeRvyvUk15ZRoY28ojnzhT6/view?usp=sharing'),
  ('c7cdd628-da94-4d72-95bf-a8a112d704ab'::uuid, 'https://drive.google.com/file/d/1vVQroYp7p22J8T7IX9BAVIIwE_iR--PQ/view?usp=sharing'),
  ('3d3ced37-24f2-4701-bc01-bf59a24b6665'::uuid, 'https://drive.google.com/file/d/1dyhWi7h_bTb55AoyXPC5p-Ep2eERiaVx/view?usp=sharing'),
  ('c0d14a33-bb77-41e7-83df-55724c42dfde'::uuid, 'https://drive.google.com/file/d/1ZUS0IJqFZtnFkI0IqeCZy7vW4eiFwf43/view?usp=sharing'),
  ('1d7f689b-3cd1-47c9-9048-5e547404d789'::uuid, 'https://drive.google.com/file/d/1DeRPrQT1rOg7eLXM4WSNaembJz5d7c5Y/view?usp=sharing'),
  ('ad7bad9f-216a-40e2-a90a-e3e050fa2efe'::uuid, 'https://drive.google.com/file/d/1yicrARfEKSBSrS__wdHRMcN7gR9stYUh/view?usp=sharing'),
  ('bac9ee5f-1a74-4303-a565-d697ebbf29ee'::uuid, 'https://drive.google.com/file/d/1pj9hJPOYz1vBZTtgiXfcdvJxoO3qe10p/view?usp=sharing'),
  ('c39c5c35-6617-4b88-8c8f-c4a0af3ee94e'::uuid, 'https://drive.google.com/file/d/1hg97y_KY6-5nOFRtPRnWjjxL2_UeaLpT/view?usp=sharing'),
  ('c132f64c-fc13-4a3c-bc73-1a1a1c01d524'::uuid, 'https://drive.google.com/file/d/1zxWAdRcXVp857Fq4F4Cp8QpTZG0OHX9Y/view?usp=sharing'),
  ('dc558869-741d-4b36-a06b-4dd35b85df35'::uuid, 'https://drive.google.com/file/d/1jIZeE1gJo2gntBw1piXJszd_GcDYbe_-/view?usp=sharing'),
  ('4589e357-3114-4dae-b69e-e3454cbddc8d'::uuid, 'https://drive.google.com/file/d/1L2U_fsXen35G4z1nWcbTatWAuMHRWDu2/view?usp=sharing'),
  ('1359e6f5-e2e9-42ce-82f5-d96a03b23a38'::uuid, 'https://drive.google.com/file/d/1SARlXgTxFItj2wkGCLVVukWcnG7VTvrq/view?usp=sharing'),
  ('e757053f-50e4-41d3-ae9f-a24803f8df1b'::uuid, 'https://drive.google.com/file/d/1HPp6IYkOpkC_ix1J9XRfU6XIA9hwsrOL/view?usp=sharing'),
  ('483dc5bd-2790-4e0a-a19a-a8171fcf12a2'::uuid, 'https://drive.google.com/file/d/1jMMzCZU7-w0zJ5HyXHjHYXpHoGVCNiYk/view?usp=sharing'),
  ('b75a21c7-c71f-4acf-a01e-f81132d10100'::uuid, 'https://drive.google.com/file/d/1ok6a_j2T1Ei27ARNpf1WToTimpCyHiae/view?usp=sharing'),
  ('204ee826-1c93-48de-ae2c-a0a5592f71e9'::uuid, 'https://drive.google.com/file/d/1LSG-4KKSuLBzX4bjZt0cAMp0JtHuZ-wI/view?usp=sharing'),
  ('6dd72c99-8c9f-4ada-8ad7-c5bb596ed687'::uuid, 'https://drive.google.com/file/d/1pLTvY4iSF7p68SAKexVz__Z--klpqqiO/view?usp=sharing'),
  ('d1334305-1939-42e4-9447-99443ec04bea'::uuid, 'https://drive.google.com/file/d/1idhECBBnZFHi2Br_0JbLUw0zaqkB7kTd/view?usp=sharing'),
  ('0881122e-20b0-4bcf-9fc0-c9fad1033ade'::uuid, 'https://drive.google.com/file/d/13oRCNqmp3AXkd93tVrS3cLc8Ntm7UEia/view?usp=sharing'),
  ('d019ddcf-86ae-429f-b2e1-6a593dd857e5'::uuid, 'https://drive.google.com/file/d/1RFSLyG2CxCBExq-j5MnvdgUSr-288t4L/view?usp=sharing'),
  ('c95599d1-35ba-4263-91b8-47f55ab1beb6'::uuid, 'https://drive.google.com/file/d/1fugFJL2N6VqPMapPZSd0Vn1Bk0o9vbX5/view?usp=sharing'),
  ('95670a9c-b88b-4892-8382-0a3337c5455c'::uuid, 'https://drive.google.com/file/d/1iiWQhOJjYM040fDskAmvhpATX3jrs4RG/view?usp=sharing'),
  ('edbab3e6-fd79-496b-b318-8ab6e6d911c2'::uuid, 'https://drive.google.com/file/d/1I9hEO08RRZrrBHGkQ1shQxhHfNOXZ8wu/view?usp=sharing'),
  ('1c54a553-61a1-4371-815f-230b0d580988'::uuid, 'https://drive.google.com/file/d/1uo74bOqcrGSBVjQrdMwoj58FNL7k1R0H/view?usp=sharing'),
  ('dc577b7d-d365-4bab-87d5-84a96c1bbd3a'::uuid, 'https://drive.google.com/file/d/1kI-FzhaoxxdRuv_s7-_6tpqoUbI4UljX/view?usp=sharing'),
  ('bfbe7685-24c2-47cf-9824-82aef7ceb6c7'::uuid, 'https://drive.google.com/file/d/1hk0z8PNvxWsG0DZXmgqaOFbGFbDbZ6l_/view?usp=sharing'),
  ('3b835bb8-a9ab-4d87-88bb-7504f952eeb7'::uuid, 'https://drive.google.com/file/d/11sfeCV0YroB5D9azouJyjDJ-Wl_SIuem/view?usp=sharing'),
  ('6c23a237-e8df-49e5-8c14-7f7188a88906'::uuid, 'https://drive.google.com/file/d/1kPaMy_LSoJGyN0ldRECXFY9uqtUNYj3h/view?usp=sharing'),
  ('cd31d00c-60c7-442e-95a6-a1dfb25e39b4'::uuid, 'https://drive.google.com/file/d/18eNaNL1uRene8qmVucDvkWvFbntls1yb/view?usp=sharing'),
  ('8d754f51-cc19-41b2-99e6-908424f89a49'::uuid, 'https://drive.google.com/file/d/1x4wDyFN5gp6mAU3SMKxtjJ5EIHZT78WO/view?usp=sharing'),
  ('65b04293-5ffc-43ea-b024-19ab22e2cadb'::uuid, 'https://drive.google.com/file/d/1Lh-A3CWWKHjk5JnQTyKh_svqQCxeXR9P/view?usp=sharing'),
  ('84dbea6c-8e10-4990-8247-df8cef35aed3'::uuid, 'https://drive.google.com/file/d/19vPuJNN_wUm6Fk4MfM1bODTd-cxF1a7R/view?usp=sharing'),
  ('d3bfa7bf-15ae-4035-9103-1c70a7c5820a'::uuid, 'https://drive.google.com/file/d/1sCn58IlSQi28T87_koJU-toB7Ahv-hVm/view?usp=sharing'),
  ('b10846a0-0b1f-4483-b74a-e1d41425bf30'::uuid, 'https://drive.google.com/file/d/14DkhVtukwApJerS8qP6hDGcNyu--ThHN/view?usp=sharing'),
  ('393c793a-b31c-4252-bea4-0930792ecda8'::uuid, 'https://drive.google.com/file/d/1uT86L9O5jz2ltvEMpRTjeyXdzrxgHymS/view?usp=sharing'),
  ('2f34274d-f241-40d9-b203-b1047630b617'::uuid, 'https://drive.google.com/file/d/1UzNo1TgvVBIjAJ_yW1I8cGcLMjKleBix/view?usp=sharing'),
  ('97cf5664-a0e8-4a15-b4f4-91b20cfc9985'::uuid, 'https://drive.google.com/file/d/1nZ3PHlpYKyo_6kq9XJshqwzG7LQloaTC/view?usp=sharing'),
  ('aee6bb86-7698-4503-bd5a-f13ab4f1b8e4'::uuid, 'https://drive.google.com/file/d/14YCP97F5bTuA5Rn7c5hXOO-Gb7bYoXPt/view?usp=sharing'),
  ('770738fa-f6f7-4f00-bb4b-d41bb079d505'::uuid, 'https://docs.google.com/document/d/1IP_uV7PorjGRBA3NPVV9n8XTqszMCZ9Z/edit?usp=sharing&ouid=105638530962391949165&rtpof=true&sd=true'),
  ('68f6071a-3fc5-4cc8-8a7e-a6ccc6f184cd'::uuid, 'https://docs.google.com/document/d/1Dx7fzP6rH75qgbzIMa1ct7AM_BKWPwSp/edit?usp=sharing&ouid=105638530962391949165&rtpof=true&sd=true'),
  ('d58128ce-101d-481f-99a2-335c5433c4de'::uuid, 'https://drive.google.com/file/d/1h5rK_ggp7VC6DZEJGKi-aWSG1POO1_Ue/view?usp=sharing'),
  ('61f6aca2-916f-4530-96a8-0cb426d1b6c8'::uuid, 'https://drive.google.com/file/d/1W2We_80vW3iN2NTqfmfdLgIMrwMcRSCE/view?usp=sharing'),
  ('a736a284-32e7-47d0-8dff-99be5732bcaa'::uuid, 'https://drive.google.com/file/d/1-rsD3TKdYtYmf56WuuOTNtIl8hx4Pt_2/view?usp=sharing'),
  ('42a14f82-3553-474d-883c-0f6c96a2d2d0'::uuid, 'https://drive.google.com/file/d/1uuuoM7Z4S-w0fbOX94a91KZobAIbpPFf/view?usp=sharing'),
  ('8c1e5678-1d4a-49ca-934c-d09d507cabb6'::uuid, 'https://drive.google.com/file/d/1xPsaoP0mPFl4od4EEqlWSXFfTi_jlJa5/view?usp=sharing'),
  ('1a78034a-f40d-4bd9-95c2-d0dabc4de9a6'::uuid, 'https://drive.google.com/file/d/19LX0tCX6qOPKQLRA4dmRSsDDaxM4-qti/view?usp=sharing'),
  ('22efdc17-888c-4572-871f-233b721b37df'::uuid, 'https://drive.google.com/file/d/170rRzzGQLO7JIbEsHapQ2V9mTupdNavL/view?usp=sharing'),
  ('8ceaa8f3-a809-46f4-8f4c-5da6bf72de53'::uuid, 'https://drive.google.com/file/d/1hZ2jPIuMmk3s4tlUBp-RIvMPdk7hKJ4J/view?usp=sharing'),
  ('bd6a650f-b35e-4026-8096-65277377e14e'::uuid, 'https://drive.google.com/file/d/1wIx3uGqFnB2uRzki0bViP6mM2WKhNIT-/view?usp=sharing'),
  ('014dacbb-47f6-40c3-b3cf-69571ebbe799'::uuid, 'https://drive.google.com/file/d/1KceLPZioIHqcEoYDZm3VsYBA-EyqcNad/view?usp=sharing'),
  ('45dc0517-d84a-4716-bee2-a0ede2500dbe'::uuid, 'https://drive.google.com/file/d/16Oqjpt68uQIMK4W9p1KOACSBwEsIg9z2/view?usp=sharing'),
  ('1e6132ca-dea7-4520-a0e9-95a3639a62a2'::uuid, 'https://drive.google.com/file/d/1jpKqXQikWWMEL-qpVOB1uaHNMJsRDuP-/view?usp=sharing'),
  ('b820be89-c8ec-489c-9b98-1e96169a6ace'::uuid, 'https://drive.google.com/file/d/1M9JDF6FdzCCxnvkQrhqcLXif86AzD6ix/view?usp=sharing'),
  ('14d89e02-d7d3-4cb0-a5f4-997f2209ae34'::uuid, 'https://drive.google.com/file/d/1SNcRCb1gweyoo-7bFTOGi8GF80A7HZhd/view?usp=sharing'),
  ('a2814501-a75c-48a9-9446-50bfec3d361e'::uuid, 'https://drive.google.com/file/d/1amoa0BVCmc23LE510qOXnIklrWHRuwXv/view?usp=sharingg'),
  ('cfd2a604-4e18-4f0c-9d72-f32ed2e2a704'::uuid, 'https://drive.google.com/file/d/1nv2l5qtKxzTpKpzW8cHzooQFt2rse73C/view?usp=sharing'),
  ('176a96b7-613c-4863-b16f-393c46870908'::uuid, 'https://drive.google.com/file/d/1haxI7BgTEjI7QnpjZHgA8-xqC-g5nCu4/view?usp=sharing'),
  ('5fbc51d7-7322-465a-8837-8ee25aa8d2a1'::uuid, 'https://drive.google.com/file/d/1F63XCfuP4z72FWEfSjpgK5ZqssGcEsp8/view?usp=sharing'),
  ('0aaf33bd-b496-4510-b43a-6746e959cbaf'::uuid, 'https://drive.google.com/file/d/1N81nCoGNFpeDDPolGLRCXlEI3YccYkLi/view?usp=sharing'),
  ('b52f3253-fa8b-46bc-bd16-277ad4b840dd'::uuid, 'https://drive.google.com/file/d/1YmVvsgQAD2Zj52z-en-h7Lxs4b9tdPwo/view?usp=sharing'),
  ('294af33f-009b-4202-8f83-53aaa090d254'::uuid, 'https://drive.google.com/file/d/1HUSO1JRV7KKsuQIguFUQeRmO_MBIZsJp/view?usp=sharing'),
  ('5178f7c8-7432-44a9-a0ff-90e58f79eddc'::uuid, 'https://drive.google.com/file/d/1sSPlGpyPmxkZXQ95eIKZmmG48jYNHb_f/view?usp=sharing'),
  ('f1cd8032-0349-40b9-8c7e-509e6d0b7bf4'::uuid, 'https://drive.google.com/file/d/1N205KvePLWe-hjp6n43uCJ-SOBuk2Qc_/view?usp=sharing'),
  ('55081699-c780-4713-af62-8bb6e441f0a7'::uuid, 'https://drive.google.com/file/d/1onUIzAQ6HYCtHC1_Y7nlfxmBQ3wOG9tC/view?usp=sharing'),
  ('d59f3f96-99a4-4702-9105-b06c723a9f80'::uuid, 'https://drive.google.com/file/d/1rDJV168cZmyC4238Vq0RyPMIiOpsu9If/view?usp=sharing'),
  ('72dc1b7f-7a7e-4182-9f64-afd75d6ffdf6'::uuid, 'https://drive.google.com/file/d/1ix67Wdov8cf3gwl3jk8RfOVtdUx7Qm8t/view?usp=sharing'),
  ('10edbf5a-cf85-472a-976a-a07d3b16ebaa'::uuid, 'https://drive.google.com/file/d/1N205KvePLWe-hjp6n43uCJ-SOBuk2Qc_/view?usp=sharingg'),
  ('832f253b-5850-4331-9137-85520ebdb164'::uuid, 'https://drive.google.com/file/d/1Ii5Fhs-B3WBLqN8uuBs-OcmBtYJ_uF-A/view?usp=sharing'),
  ('7527df63-0c60-410b-b498-548c7652018b'::uuid, 'https://drive.google.com/file/d/107ptkM9ShgwCX0KfT3-OUKK5WPSEMw1W/view?usp=sharing'),
  ('f0a054f3-054e-4615-b2bd-2c6dabcd4e74'::uuid, 'https://drive.google.com/file/d/1RU1B-XgZqvYIzYKcPM7dIIQy2NV-ko0t/view?usp=sharing'),
  ('f4beea54-bf03-4d59-9510-6aa2aafac0bc'::uuid, 'https://drive.google.com/file/d/1_ih-_vFUEngmZ2vg8fFfd8bb0gyPfpQc/view?usp=sharing'),
  ('596185e1-7518-42fb-8db0-596fd47d34f3'::uuid, 'https://drive.google.com/file/d/15Ap6Hc6lzEPCeldEtUbJ6-xdQKnq0odH/view?usp=sharing'),
  ('be1f16f7-4ffc-4396-a7c1-c1815a9fda81'::uuid, 'https://drive.google.com/file/d/1eZTfWgkFpP6cedp1YFWzsN_t2RsjKS6U/view?usp=sharing'),
  ('b028f3c3-0522-4d53-afd1-52c3ace2f3c3'::uuid, 'https://drive.google.com/file/d/1rKMs6MzMxe_WABpJt84_pq3l9U4vYG8p/view?usp=sharing'),
  ('b1121c2e-9e29-4fec-9960-035e55b91425'::uuid, 'https://drive.google.com/file/d/1GTkoMhxutntJ6Xri8_8qYEDiuraWxn1D/view?usp=sharing'),
  ('a84dd35f-651c-4df5-8d46-38fd5919fb4a'::uuid, 'https://drive.google.com/file/d/1w9utbDcuqTZ75KwTvRZVZQ9AM56R8jZ7/view?usp=sharing'),
  ('4c6e1d06-3d9d-4519-8edf-8afed2e4d663'::uuid, 'https://drive.google.com/file/d/1Q7vqUYsf1IVeddrwrRJ5IOMuQgIR1zy7/view?usp=sharing'),
  ('ca76e3e5-e091-4e48-8dc1-21e9cad166d1'::uuid, 'https://drive.google.com/file/d/1QKBnf_VOdBinlHciEiObNTRlE2J8LJV2/view?usp=sharing'),
  ('d258d121-fadd-4f96-8fdb-6be11e38fc2e'::uuid, 'https://drive.google.com/file/d/1_1o0GiTqd5-NGm7sh8t3JXd_HGIJtvgy/view?usp=sharing'),
  ('6e049107-768e-4878-a661-8a9f9c9c1bc9'::uuid, 'https://drive.google.com/file/d/1bYvDHq-e31gmo-dsjgkofrrayCcLp13v/view?usp=sharing'),
  ('fc76ac4a-9e32-4c9e-ba22-9faed6c02226'::uuid, 'https://drive.google.com/file/d/1bYvDHq-e31gmo-dsjgkofrrayCcLp13v/view?usp=sharing'),
  ('204c9887-d4bd-4c0d-8594-3487a557d5b7'::uuid, 'https://drive.google.com/file/d/10KywFeDzIMbi1jBVArhthFDVfSInFoJj/view?usp=sharing'),
  ('7b8fd129-ac87-40fe-992f-731f86641bab'::uuid, 'https://drive.google.com/file/d/1WBodxw_OMwbj90Cv_Zf_D9cVDDAyHy0b/view?usp=sharing'),
  ('a155c472-4864-4b98-be8a-2c61338c4b8f'::uuid, 'https://drive.google.com/file/d/10LJ1GIy7VkTCPmQVTjk5sVAwDNhkNOpX/view?usp=sharing'),
  ('020d36fa-dcc8-4fe5-a72e-c52144490ada'::uuid, 'https://drive.google.com/file/d/1iLVBFFRjOYDMlT3Na5KjP-d3i46p7Hqz/view?usp=sharing'),
  ('7cbaaced-15e3-40ad-90fe-5459099baba4'::uuid, 'https://drive.google.com/file/d/1sHHAONnm6jedvEwWIlkVGRDzDM3uEXLJ/view?usp=sharing'),
  ('18b51246-d877-4a75-8331-a82696ba8837'::uuid, 'https://drive.google.com/file/d/1v6DGoT25TImvStfqQXAKdnJChyDNn4zO/view?usp=sharing'),
  ('1a2afadd-6a3f-4e31-8db9-b053d0c08baf'::uuid, 'https://drive.google.com/file/d/178IuU3rSmEQgzEnvygWJNuC7hURkog-N/view?usp=sharing'),
  ('13cf30bc-35f0-4c24-89a7-17e8ba3b4ddb'::uuid, 'https://drive.google.com/file/d/1NGwJOmUUuiJxRkKoVjp-Y9R92thaVNo6/view?usp=sharing'),
  ('85cc910f-2fdc-42d2-8427-567785e870df'::uuid, 'https://drive.google.com/file/d/1hx0IK5L0M7Mmb05_VmLKVh1HjF4Irn37/view?usp=sharing')
) as v(fixture_id, url)
where exists (select 1 from public.fixtures f where f.fixture_id = v.fixture_id)
on conflict (fixture_id, url) do nothing;
