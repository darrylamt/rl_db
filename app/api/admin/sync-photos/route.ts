import { createAdminClient, createClient } from "@/lib/supabase/server";
import { fail } from "@/lib/api";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
// Photo downloads can be slow — allow up to 5 minutes
export const maxDuration = 300;

const BUCKET = "player-photos";

// Airtable base / table config
const AIRTABLE_BASE  = "appiGlfyfqWt6Vkzv";
const AIRTABLE_TABLES = [
  // Most recent first — first match wins
  { id: "tblSqVoKgDUOKvpe3", label: "2026", nameField: "fldJQrexeI5jjYMn5", photoField: "fldIqFyJqN7oLUFz2" },
  { id: "tbl6j1FN2gTRCAhLB", label: "2025", nameField: "fldXJxvA0l4mb3EUD", photoField: "fldWjLPMcq6rDZx6A" },
  { id: "tblb2ZyafvjBf2ouB", label: "2024", nameField: "fldNSBOM9L1tGnV81", photoField: "fldUPYK1qoSOcTcyy" },
];

// ── Name normalisation helpers ────────────────────────────────────────────────

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Generate candidate lookup keys from a full name string.
 *  Tries: "first last", "last first", "first middle last" → "first last", etc. */
function nameKeys(fullName: string): string[] {
  const n = normName(fullName);
  const parts = n.split(" ").filter(Boolean);
  const keys = new Set<string>();
  keys.add(n);
  if (parts.length >= 2) {
    // reversed: "last first"
    keys.add([...parts].reverse().join(" "));
    // first + last only (drop middle)
    keys.add(`${parts[0]} ${parts[parts.length - 1]}`);
    keys.add(`${parts[parts.length - 1]} ${parts[0]}`);
  }
  return Array.from(keys);
}

// ── Fetch all Airtable records for a table ────────────────────────────────────

async function fetchAirtableRecords(
  token: string,
  tableId: string,
  nameField: string,
  photoField: string
): Promise<{ name: string; url: string; filename: string }[]> {
  const results: { name: string; url: string; filename: string }[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}`);
    url.searchParams.set("fields[]", nameField);
    url.searchParams.set("fields[]", photoField);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Airtable API error: ${res.status} ${await res.text()}`);

    const json: any = await res.json();
    for (const record of json.records ?? []) {
      const cells = record.cellValuesByFieldId ?? record.fields ?? {};
      const name: string = cells[nameField] ?? "";
      const attachments: any[] = cells[photoField] ?? [];
      if (!name.trim() || attachments.length === 0) continue;
      const att = attachments[0];
      results.push({ name, url: att.url, filename: att.filename ?? "photo.jpg" });
    }

    offset = json.offset;
  } while (offset);

  return results;
}

// ── Main sync handler ─────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // Auth check
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return fail("Unauthorized", 401);

  const airtableToken =
    (await req.json().catch(() => ({})))?.token ||
    process.env.AIRTABLE_TOKEN;

  if (!airtableToken) {
    return fail(
      "No Airtable token. Add AIRTABLE_TOKEN to your environment variables or pass { token } in the request body.",
      400
    );
  }

  const admin = createAdminClient();

  // Load all players from Supabase
  const { data: players, error: playersError } = await admin
    .from("players")
    .select("player_id, first_name, last_name, photo_url");
  if (playersError) return fail(playersError.message, 500);

  // Build a lookup: normalized name → player
  const playerMap = new Map<string, typeof players[0]>();
  for (const p of players ?? []) {
    const full = normName(`${p.first_name} ${p.last_name}`);
    playerMap.set(full, p);
    // Also store reversed so "Amoatey Darryl" → still finds "Darryl Amoatey"
    const reversed = normName(`${p.last_name} ${p.first_name}`);
    if (reversed !== full) playerMap.set(reversed, p);
  }

  // Collect all Airtable photos, deduped by player (newest year wins)
  const photoMap = new Map<string, { url: string; filename: string; airtableName: string; year: string }>();

  for (const table of AIRTABLE_TABLES) {
    let records: { name: string; url: string; filename: string }[];
    try {
      records = await fetchAirtableRecords(airtableToken, table.id, table.nameField, table.photoField);
    } catch (e: any) {
      console.error(`Failed to fetch ${table.label}:`, e.message);
      continue;
    }

    for (const r of records) {
      const keys = nameKeys(r.name);
      for (const key of keys) {
        const player = playerMap.get(key);
        if (player && !photoMap.has(player.player_id)) {
          photoMap.set(player.player_id, {
            url: r.url,
            filename: r.filename,
            airtableName: r.name,
            year: table.label,
          });
          break;
        }
      }
    }
  }

  // Now download + upload each photo
  const updated: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const [playerId, photo] of Array.from(photoMap.entries())) {
    const player = (players ?? []).find((p) => p.player_id === playerId)!;

    // Skip if already stored in Supabase Storage (not an expiring Airtable URL)
    if (
      player.photo_url &&
      !player.photo_url.includes("airtableusercontent.com")
    ) {
      skipped.push(`${player.first_name} ${player.last_name} (already has permanent photo)`);
      continue;
    }

    try {
      // Download from Airtable
      const imgRes = await fetch(photo.url);
      if (!imgRes.ok) throw new Error(`Download failed: ${imgRes.status}`);
      const buffer = await imgRes.arrayBuffer();
      const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";

      // Build a stable storage path: player_id + original extension
      const ext = photo.filename.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${playerId}.${ext}`;

      // Upload (upsert so re-running is safe)
      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(path, buffer, { contentType, upsert: true });
      if (uploadError) throw new Error(uploadError.message);

      const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(path);

      // Update player
      const { error: updateError } = await admin
        .from("players")
        .update({ photo_url: publicUrl })
        .eq("player_id", playerId);
      if (updateError) throw new Error(updateError.message);

      updated.push(`${player.first_name} ${player.last_name} (${photo.year}, matched as "${photo.airtableName}")`);
    } catch (e: any) {
      failed.push(`${player.first_name} ${player.last_name}: ${e.message}`);
    }
  }

  // Players in Airtable with a photo but no rl-db match
  const unmatched: string[] = [];
  for (const table of AIRTABLE_TABLES) {
    let records: { name: string; url: string; filename: string }[] = [];
    try {
      records = await fetchAirtableRecords(airtableToken, table.id, table.nameField, table.photoField);
    } catch { continue; }
    for (const r of records) {
      const matched = nameKeys(r.name).some((k) => playerMap.has(k));
      if (!matched) unmatched.push(`${r.name} (${table.label})`);
    }
  }

  return NextResponse.json({
    ok: true,
    data: {
      updated: updated.length,
      skipped: skipped.length,
      failed: failed.length,
      unmatched: unmatched.length,
      details: { updated, skipped, failed, unmatched: [...new Set(unmatched)] },
    },
  });
}
