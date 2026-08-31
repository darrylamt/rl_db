/**
 * Gives every player a login.
 *
 *   node scripts/seed-player-accounts.mjs            # dry run — shows, changes nothing
 *   node scripts/seed-player-accounts.mjs --commit   # actually creates them
 *   node scripts/seed-player-accounts.mjs --commit --all   # inactive players too
 *
 * Email is firstname.lastname@rlfg.com and the password is the same for
 * everyone, which is only acceptable because every account is flagged to
 * change it before it can reach anything.
 *
 * Safe to run again. An account that already exists is skipped, not
 * recreated, so a run that stops halfway can simply be run again.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SHARED_PASSWORD = "RLFG@08";
const DOMAIN = "rlfg.com";

const commit = process.argv.includes("--commit");
const includeInactive = process.argv.includes("--all");

const env = readFileSync(".env.local", "utf8");
const read = (key) => (env.match(new RegExp(`^${key}=(.*)$`, "m")) ?? [])[1]?.trim();

const url = read("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = read("SUPABASE_SERVICE_ROLE_KEY") ?? read("SUPABASE_SERVICE_KEY");

if (!url || !serviceKey) {
  console.error("Missing Supabase URL or service key in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** firstname.lastname, stripped to something an email will accept. */
const slug = (s) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");

function emailFor(player, taken) {
  const first = slug(player.first_name);
  const last = slug(player.last_name);
  const stem = last ? `${first}.${last}` : first;
  if (!stem) return null;

  let candidate = `${stem}@${DOMAIN}`;
  let n = 2;
  // Two players of the same name each need their own address.
  while (taken.has(candidate)) candidate = `${stem}${n++}@${DOMAIN}`;
  taken.add(candidate);
  return candidate;
}

async function main() {
  console.log(commit ? "CREATING ACCOUNTS" : "DRY RUN — nothing will be created");
  console.log(includeInactive ? "including inactive players" : "active players only");
  console.log("");

  let query = supabase
    .from("players")
    .select("player_id, first_name, last_name, playing_status")
    .order("last_name");
  if (!includeInactive) query = query.eq("playing_status", "active");

  const { data: players, error } = await query;
  if (error) {
    console.error("Could not read players:", error.message);
    process.exit(1);
  }

  const { data: existingRows } = await supabase
    .from("app_users")
    .select("player_id, email")
    .not("player_id", "is", null);
  const already = new Set((existingRows ?? []).map((r) => r.player_id));

  // Every address in use, so a new one never collides with an account that
  // belongs to somebody else.
  const taken = new Set();
  let page = 1;
  for (;;) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    const batch = data?.users ?? [];
    batch.forEach((u) => u.email && taken.add(u.email.toLowerCase()));
    if (batch.length < 1000) break;
    page += 1;
  }

  console.log(`players to consider : ${players.length}`);
  console.log(`already have a login: ${already.size}`);
  console.log(`existing auth users : ${taken.size}`);
  console.log("");

  let created = 0;
  let skipped = 0;
  let failed = 0;
  const samples = [];

  for (const p of players) {
    if (already.has(p.player_id)) {
      skipped += 1;
      continue;
    }

    const email = emailFor(p, taken);
    const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
    if (!email) {
      console.log(`  ! no usable name, skipped: ${p.player_id}`);
      failed += 1;
      continue;
    }

    if (samples.length < 5) samples.push(`${name} -> ${email}`);

    if (!commit) {
      created += 1;
      continue;
    }

    const { data: made, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: SHARED_PASSWORD,
      email_confirm: true,
    });

    if (authError) {
      console.log(`  ! ${name} (${email}): ${authError.message}`);
      failed += 1;
      continue;
    }

    const { error: roleError } = await supabase.from("app_users").insert({
      user_id: made.user.id,
      role: "player",
      player_id: p.player_id,
      email,
      must_change_password: true,
    });

    if (roleError) {
      // Leave nothing half-made: an account with no role reaches nothing.
      await supabase.auth.admin.deleteUser(made.user.id);
      console.log(`  ! ${name}: ${roleError.message}`);
      failed += 1;
      continue;
    }

    created += 1;
    if (created % 25 === 0) console.log(`  ...${created} created`);
  }

  console.log("");
  console.log(commit ? "created" : "would create", created);
  console.log("already had one    ", skipped);
  console.log("failed             ", failed);
  if (samples.length) {
    console.log("");
    console.log("addresses look like:");
    samples.forEach((s) => console.log("   " + s));
  }
  if (!commit) {
    console.log("");
    console.log("Nothing was changed. Re-run with --commit to create them.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
