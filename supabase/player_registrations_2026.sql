-- ============================================================
-- 2026 player registrations.
--
-- Taken from the federation's own Airtable export,
-- "RLFG PLAYER REGISTERATION_ 2026 RLFG PLAYER REGISTRATION". All 147
-- rows matched a player already on record, so this creates no players — it
-- records who is registered for 2026 and repairs a few gaps.
--
-- Players were matched on date of birth rather than name. The export writes
-- some names surname-first ("Agbemenu Kodzo Tony" for "Kodzo Tony
-- Agbemenu"), and matching on the name as written would have created eight
-- duplicate players for people already in the database.
--
-- Run any time. Safe to re-run.
-- ============================================================

-- ── 1. Status casing ────────────────────────────────────────
-- Four rows read 'Active'. Every filter in the API and the admin compares
-- against 'active', so those players were invisible to them.
update players set playing_status = lower(playing_status)
where playing_status is not null and playing_status <> lower(playing_status);

-- ── 2. Club for players who had none ────────────────────────
-- Their 2026 registration names the club; the player record was blank.
update players set team_id = '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5' where player_id = 'a8f21f00-461d-4572-a798-ac2170c21ab0' and team_id is null;  -- George Tetteh Ayettey -> Titans
update players set team_id = '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5' where player_id = '2fd79995-a4dc-4f19-9038-001897a97497' and team_id is null;  -- Boateng Stephen -> Titans
update players set team_id = '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5' where player_id = '6037a488-a197-44a6-886e-0ae0fb9e5424' and team_id is null;  -- Quarshie Nii Odoi Desmond -> Titans
update players set team_id = '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5' where player_id = 'f0abc1ae-5af7-42ea-a065-394ed7069ccc' and team_id is null;  -- Ken Turkson -> Titans
update players set team_id = '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5' where player_id = 'bcd2ef53-fed1-4d29-819b-1b1138346885' and team_id is null;  -- Edwin Teye -> Titans
update players set team_id = '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5' where player_id = '82e1f8fc-ca39-4243-aab9-8455d569aeec' and team_id is null;  -- Constantine Offei -> Titans

-- ── 3. The 2026 register ────────────────────────────────────
-- player_registrations is how a player is marked active for a season.
--
-- One player is deliberately absent. Joseph Mensah appears twice in the
-- export, registered to Dragons and to Nungua Tigers, and his player record
-- says Nungua Tigers. Picking one would be a guess, and Postgres rejects an
-- upsert that hits the same row twice in a statement, so he is left for
-- someone to resolve in /admin/registrations.

insert into player_registrations (player_id, team_id, season_year) values
  ('2e135d98-19b2-4b0c-b6c9-98b8d0bbcc75', 'd135869f-7f43-427e-b9b5-a1496483a550', 2026),
  ('f413e5a9-62d3-4557-82f8-ec1f1ffc391a', 'd135869f-7f43-427e-b9b5-a1496483a550', 2026),
  ('2896a758-f92e-4763-b44e-1cb13482f951', 'd135869f-7f43-427e-b9b5-a1496483a550', 2026),
  ('43f0e887-ddf2-44e0-82ab-479a6e62308b', 'd135869f-7f43-427e-b9b5-a1496483a550', 2026),
  ('eeee2111-d846-41f8-afed-d3b64d70e2ab', 'd135869f-7f43-427e-b9b5-a1496483a550', 2026),
  ('fca12521-ac2e-4dae-80ed-36cc5403e3f2', 'd135869f-7f43-427e-b9b5-a1496483a550', 2026),
  ('9c99d5d6-15e2-4739-841d-ddff5fa89e93', 'd135869f-7f43-427e-b9b5-a1496483a550', 2026),
  ('24204732-96ae-41b3-9d9e-b7f6ab1abed7', 'd135869f-7f43-427e-b9b5-a1496483a550', 2026),
  ('b4e9da10-2de1-4e81-8b9a-cf1fae0add08', 'd135869f-7f43-427e-b9b5-a1496483a550', 2026),
  ('ecefbb78-030d-4645-84f7-2a6c115f9bb7', 'd135869f-7f43-427e-b9b5-a1496483a550', 2026),
  ('a5f44e10-71a4-4333-b478-41c255f67ffc', 'd135869f-7f43-427e-b9b5-a1496483a550', 2026),
  ('2cd76f95-605a-48fa-b4e3-c692bee2c55a', 'd135869f-7f43-427e-b9b5-a1496483a550', 2026),
  ('6f698a1a-c49f-4e85-aef0-da141b08f56b', 'd135869f-7f43-427e-b9b5-a1496483a550', 2026),
  ('a19226f7-ba27-4a3e-b4f7-c29e6459bf18', 'd135869f-7f43-427e-b9b5-a1496483a550', 2026),
  ('4c5250c2-956a-476a-95ff-ae68fc932190', 'd135869f-7f43-427e-b9b5-a1496483a550', 2026),
  ('ae0dd63d-cdef-48ef-968d-8b02dc56fa8b', 'd135869f-7f43-427e-b9b5-a1496483a550', 2026),
  ('76010e11-1157-4ba2-a98f-f5b6c6d826e6', 'd135869f-7f43-427e-b9b5-a1496483a550', 2026),
  ('d5439424-0df7-446f-9a56-e1df8aa12db5', 'd135869f-7f43-427e-b9b5-a1496483a550', 2026),
  ('185a5399-29dd-41ef-9f4c-b5292164c4a6', 'd135869f-7f43-427e-b9b5-a1496483a550', 2026),
  ('fa7b1072-61c6-4acc-9525-fa03ac03be29', 'd135869f-7f43-427e-b9b5-a1496483a550', 2026),
  ('17930882-b36e-4ab3-89a7-fbd346067a3c', 'd135869f-7f43-427e-b9b5-a1496483a550', 2026),
  ('9f9e7844-40b5-4645-b6e3-4c47d2ea643f', 'd135869f-7f43-427e-b9b5-a1496483a550', 2026),
  ('2a6b37a6-815f-4d2d-b790-047494b3e73f', 'd135869f-7f43-427e-b9b5-a1496483a550', 2026),
  ('bbe78a56-b808-4f35-86cf-bdd87a2405c2', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('ca096037-c0a4-471c-a81d-742945380974', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('d2b59b6b-df81-412c-af50-eaf27df08a33', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('7ad6389d-0ecd-4447-902c-83144ce0c045', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('f788da2e-870f-43ed-9d1b-5abfc84b41a2', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('ba0756dc-ee5c-489e-b047-8b9b0d8aaecb', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('fdd1abab-02f8-42d9-9251-5c36b9715514', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('fe6ac9f9-1f61-49ce-a32c-8f5fcd56b055', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('a975306a-f80c-493a-a8fc-681d57d13307', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('d3f3d71f-9bd2-4b52-a591-b6f4b8e7dffa', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('ffa54b75-8e55-46a0-9f19-079b1e5f107c', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('6fb19fd8-8408-43a4-b9cd-b7c6bdda7da7', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('5540300d-5b33-4d6a-98ec-ab15e349db12', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('18800293-288e-4388-80b0-b62bfff0b880', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('392badc0-5642-42a8-b6b2-d3eedd44eeab', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('afd18433-0dc1-489c-b60d-c3f8644eb7b0', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('b3f7228d-7ca2-4d8a-bf08-919ac390428a', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('a3124c23-1e6a-4668-a90c-7822c3199e61', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('60420df6-4782-4e2c-b67a-79c456780edf', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('688fbf1c-9f1e-4a73-8f12-d1c01bb48588', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('e11e1df3-574c-4d70-a7d5-9c566dd841d8', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('41b54c11-ac4e-4af6-add4-825e5d1bc70d', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('106ecf46-8423-446f-a4ce-c658d34376e8', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('884ddc16-edfc-4f2f-8892-fba4c3e054e2', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('2fc094e1-1cbc-4c4d-a691-e15fc6a7972c', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('1c65f7d8-3bc4-4a54-ad02-f6d49dab381f', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('7372abe0-52b9-4c4c-8ca5-9878d9700ae2', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('2debfcbb-6ef8-4d5f-8959-e229043be0ac', 'e9c8008f-3ccf-4ad1-8e46-b28f979e6ee9', 2026),
  ('7abcd550-f324-4274-9562-f6019ff3797d', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('43ac0003-a34e-4f4b-a389-145d5ccb136a', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('ae2e3ae5-728d-4eda-a097-53958983385d', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('a1878ecd-ecdf-431d-9b5c-d332adce22c9', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('59d25131-9c23-4b34-859c-9175985adf21', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('28f29cb2-770a-4f59-b817-deb20640ff0f', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('8911d8b0-35c1-4e68-aa4d-023e2e1604ad', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('c946fd36-1fe2-4c8e-9703-57156507fb9a', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('1bb046c2-88aa-46d1-93b7-c91c1fcd97a8', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('16e8fab8-2680-46eb-bed9-4573c71242fd', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('89501090-2d46-4b25-8b49-de48ed79e8f9', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('96f0c748-319a-4632-8fe3-04ef48d485f4', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('2fc48743-ebdb-4040-99a6-76d3a5e2e22e', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('5f5a5f76-227d-4afb-9e67-4243715e6d88', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('b5a2d3e7-07a3-41be-87d2-68cd93af3e6f', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('84e1d6f8-d893-4e8b-bd67-9707d7ce3450', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('d7c7f877-5499-461e-8b89-cf7b2b3da780', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('f06ca6e3-5da6-4ddb-b253-2fce0c60c6a2', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('2f09b27d-d824-44d1-93ae-99e626c6a3f3', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('c76d18a5-f805-4087-b92c-83c700baccef', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('28bcefe6-3ad1-42e9-a3e4-b8d103af12b2', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('be22239e-286c-4637-b2a7-3abbff69d6fa', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('4dc00609-97a4-44a8-b0af-93d480449de4', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('1ac8ba1b-3eb3-4cb0-a047-f4792cc0b2a8', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('b109a2f8-ff05-4748-84f6-d7963fdf31a6', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('8f64ad64-e03c-42cb-902a-1a0fcf5ba44f', '60c7ebd3-c0b3-44b6-ba47-4ba3726a3643', 2026),
  ('cd523b0f-7f63-460b-b859-92f23813e89c', 'e50142d3-ead1-4b9c-a3b5-4fdc08e2b731', 2026),
  ('15a6feb7-59d2-4438-9bd1-b7bb40379abb', 'e50142d3-ead1-4b9c-a3b5-4fdc08e2b731', 2026),
  ('c976291f-bca0-49be-a057-a28e553aabac', 'e50142d3-ead1-4b9c-a3b5-4fdc08e2b731', 2026),
  ('031b6d7b-52ea-4bd9-8b77-7a5c61f89b0d', 'e50142d3-ead1-4b9c-a3b5-4fdc08e2b731', 2026),
  ('d70a2ca6-7751-4aba-ba91-a1b22053c9fe', 'e50142d3-ead1-4b9c-a3b5-4fdc08e2b731', 2026),
  ('af1c9847-635b-4de9-93ed-8667e712fe4c', 'e50142d3-ead1-4b9c-a3b5-4fdc08e2b731', 2026),
  ('54e5a391-4fff-422c-8d69-50dc31384e1f', 'e50142d3-ead1-4b9c-a3b5-4fdc08e2b731', 2026),
  ('8eb07d5b-d75b-44e0-8d66-11e4e5b6b94e', 'e50142d3-ead1-4b9c-a3b5-4fdc08e2b731', 2026),
  ('688efac7-f4d9-42cd-ad89-c812147dea78', 'e50142d3-ead1-4b9c-a3b5-4fdc08e2b731', 2026),
  ('064fc23f-20b5-4c81-bd38-5fc44ab66b02', 'e50142d3-ead1-4b9c-a3b5-4fdc08e2b731', 2026),
  ('2ddfa6e9-b816-4be5-8036-a194a976e5b1', 'e50142d3-ead1-4b9c-a3b5-4fdc08e2b731', 2026),
  ('a90fe230-30d8-41f3-956a-834f46ad4664', 'e50142d3-ead1-4b9c-a3b5-4fdc08e2b731', 2026),
  ('e1f87d00-0982-4301-88f9-547208e9ab8d', 'e50142d3-ead1-4b9c-a3b5-4fdc08e2b731', 2026),
  ('97eb3edd-33d0-41ec-bf54-45f5273535de', 'e50142d3-ead1-4b9c-a3b5-4fdc08e2b731', 2026),
  ('761ad6c8-1071-44bb-818a-2ae1c084eaae', 'e50142d3-ead1-4b9c-a3b5-4fdc08e2b731', 2026),
  ('89513960-aec3-4dd0-83e6-e15aaad91027', 'e50142d3-ead1-4b9c-a3b5-4fdc08e2b731', 2026),
  ('73ea7bbe-6ae0-45fc-921a-bf9c1af88505', 'e50142d3-ead1-4b9c-a3b5-4fdc08e2b731', 2026),
  ('9192d5aa-191a-465b-a647-4d7aa13fff93', 'e50142d3-ead1-4b9c-a3b5-4fdc08e2b731', 2026),
  ('9ca1f0a7-5a87-4754-ae17-6420a331eabb', 'e50142d3-ead1-4b9c-a3b5-4fdc08e2b731', 2026),
  ('f7099dca-becf-43d8-9b83-309b399eaf2d', 'e50142d3-ead1-4b9c-a3b5-4fdc08e2b731', 2026),
  ('78e6309b-d9b8-4b5b-831b-980de4b49887', 'e50142d3-ead1-4b9c-a3b5-4fdc08e2b731', 2026),
  ('8ffe1004-e4ed-4604-9079-b317f722b275', 'e50142d3-ead1-4b9c-a3b5-4fdc08e2b731', 2026),
  ('15097a9c-359d-4665-a078-c68916733f1b', 'a4bdc05a-98b0-41fc-ac9a-c6344bcc6e23', 2026),
  ('3a6dce6e-0fe3-45ee-8bbc-502d90489b79', 'a4bdc05a-98b0-41fc-ac9a-c6344bcc6e23', 2026),
  ('e027c7b5-370c-466f-9e1d-da4f0a01fde7', 'a4bdc05a-98b0-41fc-ac9a-c6344bcc6e23', 2026),
  ('c768b925-efb8-4398-b60c-01fb8bb0ae95', 'a4bdc05a-98b0-41fc-ac9a-c6344bcc6e23', 2026),
  ('58ff306a-754b-4761-982d-629322ee00aa', 'a4bdc05a-98b0-41fc-ac9a-c6344bcc6e23', 2026),
  ('6fa9cd0b-19a8-4093-a7ad-5e3836836320', 'a4bdc05a-98b0-41fc-ac9a-c6344bcc6e23', 2026),
  ('56dee25f-1a4b-481d-a4b6-2e1ede3161b0', 'a4bdc05a-98b0-41fc-ac9a-c6344bcc6e23', 2026),
  ('29d0325d-013b-41c9-8f56-ee838f539000', 'a4bdc05a-98b0-41fc-ac9a-c6344bcc6e23', 2026),
  ('61b5a84d-b4c1-4520-ac78-74526acd61f5', 'a4bdc05a-98b0-41fc-ac9a-c6344bcc6e23', 2026),
  ('983179f5-68ec-4526-a7c7-e8966ac782ca', 'a4bdc05a-98b0-41fc-ac9a-c6344bcc6e23', 2026),
  ('af3c6dd0-1750-4e7f-aa66-82f049146426', 'a4bdc05a-98b0-41fc-ac9a-c6344bcc6e23', 2026),
  ('6dd1ec93-489e-444e-b465-e53b10999ec4', 'a4bdc05a-98b0-41fc-ac9a-c6344bcc6e23', 2026),
  ('4e94352b-b679-47f4-9c0f-b21a5e86b3a2', 'a4bdc05a-98b0-41fc-ac9a-c6344bcc6e23', 2026),
  ('3c3336fa-157f-4a5f-9f18-b0512a6651cf', 'a4bdc05a-98b0-41fc-ac9a-c6344bcc6e23', 2026),
  ('eca615d5-9341-4840-819e-f471dd327c6d', 'a4bdc05a-98b0-41fc-ac9a-c6344bcc6e23', 2026),
  ('81c69f14-b9c7-44a7-b7da-710726696833', 'a4bdc05a-98b0-41fc-ac9a-c6344bcc6e23', 2026),
  ('199fa02d-741a-4b70-bf87-0eddb3cf01af', 'a4bdc05a-98b0-41fc-ac9a-c6344bcc6e23', 2026),
  ('b6253d9c-b998-4e10-8667-d0e7e8e58377', 'a4bdc05a-98b0-41fc-ac9a-c6344bcc6e23', 2026),
  ('02bd85c7-da7f-4b19-bf6e-bbcc723015a2', 'a4bdc05a-98b0-41fc-ac9a-c6344bcc6e23', 2026),
  ('00b217bf-36c8-436a-b248-b629e7e785c7', 'a4bdc05a-98b0-41fc-ac9a-c6344bcc6e23', 2026),
  ('77141020-565e-4d02-a5b1-5d4536ecdf0c', 'a4bdc05a-98b0-41fc-ac9a-c6344bcc6e23', 2026),
  ('10a517f1-a1f6-4411-bdb6-25c1d66187a7', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026),
  ('91941f23-8243-40fa-a2ad-7328350c6b7c', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026),
  ('a28ae1c9-e42f-43c8-a114-dcfecea4e7dd', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026),
  ('0bcaf642-9a61-4a8e-9d71-8fef2fece3e4', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026),
  ('a8f21f00-461d-4572-a798-ac2170c21ab0', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026),
  ('c511ccd7-91e4-4dfd-a18c-8fd35165b026', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026),
  ('f20c3c7f-a5c6-44a6-8de4-9a7ec2671198', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026),
  ('2ee50b75-1b02-44a0-b667-08f698397c0e', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026),
  ('697f0e63-e8de-468e-ad54-c9683f202aef', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026),
  ('8843b4b1-ef93-49f2-aa32-9165d1827d24', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026),
  ('0b8a7dfe-aefc-4cda-ab5b-d1b5175e9d80', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026),
  ('2fd79995-a4dc-4f19-9038-001897a97497', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026),
  ('91af3347-1f33-4315-8c5f-3109502dc554', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026),
  ('4623979d-c9aa-41bd-aa3b-02b0be9b46b0', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026),
  ('36c9f97d-976f-4b0d-b297-9deebd055be4', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026),
  ('bcedc398-9164-4fce-9f76-bdb7c60e8abf', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026),
  ('573e4b1f-8079-4a11-8117-a9d1ac73afcb', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026),
  ('1bb30845-fcd9-49a5-8947-b5b57ce4b3be', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026),
  ('1bc3556a-c489-4b09-be2c-ec8836f80713', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026),
  ('6037a488-a197-44a6-886e-0ae0fb9e5424', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026),
  ('28aa6c4b-95e6-407c-971b-5d005ef1e753', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026),
  ('c028217a-0381-4b73-9dda-37a28e1d097e', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026),
  ('f0abc1ae-5af7-42ea-a065-394ed7069ccc', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026),
  ('bcd2ef53-fed1-4d29-819b-1b1138346885', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026),
  ('82e1f8fc-ca39-4243-aab9-8455d569aeec', '458b66cd-07b3-4b33-98a9-8d3e8cdb87e5', 2026)
on conflict (player_id, season_year) do update set team_id = excluded.team_id;
