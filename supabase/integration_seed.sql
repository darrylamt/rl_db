-- ============================================================
-- Integration seed — mirrors the JSON the public site ships today.
-- Run AFTER integration_schema.sql. Safe to re-run: each section clears
-- and reloads its table, so re-running resets to these values.
--
-- Image paths stay relative (/reports/..., /team/...) because those files
-- live in the website's public/ folder and are served from there.
-- ============================================================

-- ── DOCUMENTS (46) ──
delete from documents;
insert into documents (name, type, link, thumbnail_url, sort_order) values
  ('Salford Red Devils & RLFG Annual Review', 'Reports', 'https://drive.google.com/file/d/1Bl1AEokoNX64wvAbmeQfAiyjTIu_SAfZ/view', '/reports/2025_slf_red.jpg', 0),
  ('2025 Annual Report', 'Reports', 'https://drive.google.com/file/d/1ZB3hWfM1lPPp_rzNOZK7iCXZubIHakOT/view', '/reports/2025.png', 1),
  ('2024 Annual Report', 'Reports', 'https://drive.google.com/file/d/1LE_EsHZP-8tTp_OcIEIFacWRkj3vkb4e/view', '/reports/2024.png', 2),
  ('2023 Annual Report', 'Reports', 'https://drive.google.com/file/d/1AvDj32756FMhY1TXmP6mf5I5UCYRNaAz/view', '/reports/2023.png', 3),
  ('2022 Annual Report', 'Reports', 'https://drive.google.com/file/d/16V_8SdcsyJyFh0ZxJwbHiCHdUqC33jRA/view', '/reports/2022.png', 4),
  ('2021 Annual Report', 'Reports', 'https://drive.google.com/file/d/1rUbZ8x0wOC8SXEJ_e46aHH9DXkmNJkWV/view', '/reports/2021.png', 5),
  ('2021 Origins Cup', 'Reports', 'https://drive.google.com/file/d/1pJ5166641nZJFHYBlAKm7bwt8GGKBd8U/view', '/reports/2021_origins.png', 6),
  ('2020 Annual Report', 'Reports', 'https://drive.google.com/file/d/1gmawcpmNoKj16yvcZc_Tn5JidUf8eJn8/view', '/reports/2020.png', 7),
  ('2019 Annual Report', 'Reports', 'https://drive.google.com/file/d/1lUeDaoMEXuBSE-noZs2rokcL4rERFvNs/view', '/reports/2019.png', 8),
  ('RLFG Milestones', 'Reports', 'https://drive.google.com/file/d/1L2SS2Rxfi4am5_V-I0bm8qq79evlOm_B/view', '/reports/milestones.png', 9),
  ('2026 May RLFG Report', 'Monthly Developmental Reports', 'https://drive.google.com/file/d/1_Ye7PG_ll7DK81nwVgQEpl9mNW_3eHcP/view', '/reports/may6.jpg', 10),
  ('2026 April RLFG Report', 'Monthly Developmental Reports', 'https://drive.google.com/file/d/1eAi4OZIdWWkCFcwSuNjpC6iYYskx1Ht1/view', '/reports/apr6.jpg', 11),
  ('2026 March RLFG Report', 'Monthly Developmental Reports', 'https://drive.google.com/file/d/1TFRNQARy7utfmPnM1ScCSBEtRf2AJOc0/view', '/reports/mar6.jpg', 12),
  ('2026 February RLFG Report', 'Monthly Developmental Reports', 'https://drive.google.com/file/d/1ays4s_nksPlysz3yuGDT0wY7aIJH9tjX/view', '/reports/feb6.jpg', 13),
  ('2026 January RLFG Report', 'Monthly Developmental Reports', 'https://drive.google.com/file/d/1BSODaJOSA2wCpBL0TVKYQ0lII4yxZYa6/view', '/reports/jan6.jpg', 14),
  ('2025 November Salford x RLFG Report', 'Monthly Developmental Reports', 'https://drive.google.com/file/d/1tj9DH1Dr1kjA67_mPyQ71bSYIsIDnwPL/view', '/reports/nov5.jpg', 15),
  ('2025 October Salford x RLFG Report', 'Monthly Developmental Reports', 'https://drive.google.com/file/d/1LP1oUcSFbE1d1vQZE2BJHVL7Zf3FhNCh/view', '/reports/oct5.jpg', 16),
  ('2025 September Salford x RLFG Report', 'Monthly Developmental Reports', 'https://drive.google.com/file/d/1sMHICLsvymIJIXq7PIl6EgmrDoBAfhGw/view', '/reports/sept5.jpg', 17),
  ('2025 July Salford x RLFG Report', 'Monthly Developmental Reports', 'https://drive.google.com/file/d/1gu68sTrKn30c1B_vz1hq-cz5KYg0AUEt/view', '/reports/july5.jpg', 18),
  ('2025 June Salford x RLFG Report', 'Monthly Developmental Reports', 'https://drive.google.com/file/d/14S_G0mmI-53FYQgM0BgzoWiZZrVErphU/view', '/reports/june.jpg', 19),
  ('2025 May Salford x RLFG Report', 'Monthly Developmental Reports', 'https://drive.google.com/file/d/1k-Sc2E3cju3hYkPJsic4PpKLXhra53XS/view', '/reports/may.jpg', 20),
  ('2025 April Salford x RLFG Report', 'Monthly Developmental Reports', 'https://drive.google.com/file/d/1fA9d0F-ROfhFtMkV6v61mEQYvtb7nhDU/view?usp=drive_link', '/reports/apr.jpg', 21),
  ('2025 March Salford x RLFG Report', 'Monthly Developmental Reports', 'https://drive.google.com/file/d/1sKKvxuimYUPdvDpqOK9wNphVFKiko6ec/view?usp=drive_link', '/reports/mar.jpg', 22),
  ('2025 February Salford x RLFG Report', 'Monthly Developmental Reports', 'https://drive.google.com/file/d/1d5H8JbnVDxZpQ38nm-3ksApBHdLBoVPB/view?usp=drive_link', '/reports/feb.jpg', 23),
  ('2025 January Salford x RLFG Report', 'Monthly Developmental Reports', 'https://drive.google.com/file/d/1nL0sfZ6bUHN7gov5HGF7fG5b18Z-oQzM/view?usp=drive_link', '/reports/jan.jpg', 24),
  ('2024 November Salford x RLFG Report', 'Monthly Developmental Reports', 'https://drive.google.com/file/d/1cw-dZ6Zc0r3l0LObx3oHaLIOHjFciC5F/view?usp=drive_link', '/reports/nov.jpg', 25),
  ('2024 October Salford x RLFG Report', 'Monthly Developmental Reports', 'https://drive.google.com/file/d/1a5Ko-36QEgxxN_33pI3WFGvnY4GyI40a/view?usp=drive_link', '/reports/oct.jpg', 26),
  ('2024 September Salford x RLFG Report', 'Monthly Developmental Reports', 'https://drive.google.com/file/d/1HiA2BR1G706tsW5pfJyaYIP6zAGXUPPd/view?usp=drive_link', '/reports/sep.jpg', 27),
  ('2024 August Salford x RLFG Report', 'Monthly Developmental Reports', 'https://drive.google.com/file/d/12kiFhztn48NBojBj4mmfTlkd7mLnnhDO/view?usp=drive_link', '/reports/aug.jpg', 28),
  ('2024 July Salford x RLFG Report', 'Monthly Developmental Reports', 'https://drive.google.com/file/d/1A4TXjNDI2gK_0xYBLJCrrjoaluWh4E9o/view?usp=drive_link', '/reports/jul.jpg', 29),
  ('Minutes of AGM with of RLFG Board | 2023', 'Annual General Meetings', 'https://drive.google.com/file/d/1wEHRbCUkKRYPwq94qhRzUdtw5XQ-wHdC/view', '/minutes/2023.png', 30),
  ('Minutes of AGM on Zoom | April 2023', 'Annual General Meetings', 'https://drive.google.com/file/d/1wEHRbCUkKRYPwq94qhRzUdtw5XQ-wHdC/view', '/minutes/2023.png', 31),
  ('Minutes of AGM with of RLFG Board | 2022', 'Annual General Meetings', 'https://drive.google.com/file/d/1MVoBsMSfHIqgr_8pjU3Ddf4LdVjl7JrJ/view', '/minutes/2022.png', 32),
  ('Minutes of AGM on Zoom | 2021', 'Annual General Meetings', 'https://drive.google.com/file/d/1FtqGrGAs3lAdW37wcxAGkX3bsl4oC9DJ/view', '/minutes/2021.png', 33),
  ('Code of Conduct', 'Policies', 'https://drive.google.com/file/d/1z3_pQl1lHj81FFPClXhrFHjbKVLROJK_/view', '/policies/coc.png', 34),
  ('Financial Controls Policy', 'Policies', 'https://drive.google.com/file/d/1JadQJxiCCaj8WSG7aFaP7T-unee3Rvfs/view', '/policies/fcp.png', 35),
  ('Minimum Standards Policy', 'Policies', 'https://drive.google.com/file/d/19_NqlV1o8a_McefGS6vWCHXXoMMYEB3t/view', '/policies/coc.png', 36),
  ('Two Year Regional Rugby League Development Strategy', 'Policies', 'https://drive.google.com/file/d/1NA_6WAC_RROKf7fV7X_bHiZ_bbFUGu9L/view', '/policies/dvs.png', 37),
  ('Diversity & Equity Policy', 'Policies', 'https://drive.google.com/file/d/1zxc-42rEkIKBynoykftCUhN_3tv2UV4B/view', '/policies/dep.png', 38),
  ('Match Review & Judiciary Policy', 'Policies', 'https://drive.google.com/file/d/1IBCojaLgcRN-L7WRe1HqA_TL0hbGsfV4/view', '/policies/revp.png', 39),
  ('Membership Policy', 'Policies', 'https://drive.google.com/file/d/1fWli3s6f21RWCR0eGcFj5ZS0pfk2QCmx/view', '/policies/mmp.png', 40),
  ('RLFG Media Protocol', 'Policies', 'https://drive.google.com/file/d/171CE_ClKyZv345iPaxyHFtDY5sf_uxOa/view', '/policies/mdp.png', 41),
  ('RLFG Constitution', 'Policies', 'https://drive.google.com/file/d/1qCo5DmB31SYNtzNiTqz31WQPnMOGwI0R/view', '/policies/const.png', 42),
  ('RLFG Operational Rules', 'Policies', 'https://drive.google.com/file/d/1glGSniUKHwnlVP-ble9SadwAcc0Wi7x8/view', '/policies/opr.png', 43),
  ('Ethics Statement', 'Policies', 'https://drive.google.com/file/d/1GCVIxQaxwR6J1iR0GiTsuhUsu3Qmfk4n/view', '/policies/eth.png', 44),
  ('Safeguarding (Child Protection) Policy', 'Policies', 'https://drive.google.com/file/d/1RUZgz17uUg26FaJaVCst84HpAk2wk-9z/view', '/policies/sfg.png', 45);

-- ── PEOPLE (board 6, committee 5) ──
delete from people;
insert into people (name, role, email, photo_url, group_name, sort_order) values
  ('Juliana Storey', 'President', 'jstorey@360deg.org', '/team/12.png', 'board', 0),
  ('Daniel O. Djane', 'Vice President', 'odjanie@rlghana.com', '/team/9.png', 'board', 1),
  ('Judith E.A Yengbe', 'Secretary', 'judithyengbe@gmail.com', '/team/10.png', 'board', 2),
  ('Richard T.K Borsah', 'Treasurer', 'rtkborsah@gmail.com', '/team/8.png', 'board', 3),
  ('Augustine Amissare', 'Member', 'kamissare@gmail.com', '/team/7.png', 'board', 4),
  ('Robert Oram', 'Member', 'roboram1705@gmail.com', '/team/1.png', 'board', 5),
  ('Jafaru A. Mustapha', 'General Manager', 'jmustapha@rlghana.com', '/team/2.png', 'committee', 0),
  ('Emmanuel D. Akuklu', 'Assistant Manager', 'eakuklu@rlghana.com', '/team/4.png', 'committee', 1),
  ('Marshall Nortey', 'Technical Director', 'mnortey@rlghana.com', '/team/6.png', 'committee', 2),
  ('David K. Abossey', 'Finance', 'david.Abossey@rlghana.com', '/team/5.png', 'committee', 3),
  ('Hilaria Wuaku', 'Communications', 'hwuaku@rlghana.com', '/team/3.png', 'committee', 4);

-- ── PARTNERS ──
delete from partners;
insert into partners (name, link, logo_url, designation, tier, tier_title, sort_order) values
  ('Polytank Ghana Limited', null, '/partners/polytank.png', null, 1, 'Official Partners', 0),
  ('Salford Red Devils', null, '/partners/salford.png', null, 1, 'Official Partners', 1),
  ('Jibu', null, '/partners/jibu.png', null, 1, 'Official Partners', 2),
  ('Firm Foods', null, '/partners/firmfoods.png', null, 1, 'Official Partners', 3),
  ('Velocity Sports Labs', 'https://velocitysportslabs.com', '/partners/vsl.png', null, 1, 'Official Partners', 4),
  ('Ghanaian Times', null, '/partners/ghtimes.png', null, 2, 'Media Partners', 0),
  ('GTS Sports+', null, '/partners/gtvs.png', null, 2, 'Media Partners', 1),
  ('GNTV Junior', null, '/partners/gntv.png', null, 2, 'Media Partners', 2),
  ('Let''s Do It Ghana', null, '/partners/ldigh.png', null, 3, 'CSR Partners', 0),
  ('Regardless', null, '/partners/regardless.png', null, 3, 'CSR Partners', 1);
