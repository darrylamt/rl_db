"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireFederation, requireMatchRecorder } from "@/lib/auth";

/**
 * Match sheets: photos and scans of a match's team sheets and scoring record.
 *
 * They are the evidence behind a result, kept so a score or a try can be
 * checked against what was written down on the day. Recorders and the
 * federation add them; only the federation takes one off, and the page asks
 * first.
 */

export type MatchDocument = {
  document_id: string;
  fixture_id: string;
  kind: "team_sheet" | "events" | "other";
  url: string;
  note: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type MatchDocumentsRead = {
  documents: MatchDocument[];
  /** False until supabase/match_sheets.sql has been run. */
  ready: boolean;
};

const KINDS = new Set(["team_sheet", "events", "other"]);

/** A match's sheets, oldest first — the order they were put up. */
export async function listMatchDocuments(fixtureId: string): Promise<MatchDocumentsRead> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("fixture_documents")
    .select("document_id, fixture_id, kind, url, note, uploaded_by, created_at")
    .eq("fixture_id", fixtureId)
    .order("created_at", { ascending: true });

  // The table not existing yet is not an error worth breaking a page over.
  if (error && (error.code === "42P01" || error.code === "PGRST205")) {
    return { documents: [], ready: false };
  }
  if (error) throw new Error(error.message);
  return { documents: (data ?? []) as MatchDocument[], ready: true };
}

function refresh(fixtureId: string) {
  revalidatePath(`/admin/results/${fixtureId}`);
  revalidatePath(`/enter/match/${fixtureId}`);
  revalidatePath(`/live/${fixtureId}`);
}

/**
 * Records a sheet that has already been uploaded (or a link to one kept
 * elsewhere, such as Google Drive, where the older sheets live).
 */
export async function addMatchDocument(
  fixtureId: string,
  input: { kind: string; url: string; note?: string | null }
): Promise<{ error?: string }> {
  try {
    const user = await requireMatchRecorder();
    const url = (input.url ?? "").trim();
    if (!/^https?:\/\//i.test(url)) return { error: "That isn't a web address." };
    const kind = KINDS.has(input.kind) ? input.kind : "other";

    const supabase = createAdminClient();
    const { error } = await supabase.from("fixture_documents").insert({
      fixture_id: fixtureId,
      kind,
      url,
      note: input.note?.trim() || null,
      uploaded_by: user.email,
    });
    if (error?.code === "23505") return { error: "That sheet is already on this match." };
    if (error?.code === "42P01" || error?.code === "PGRST205") {
      return { error: "Match sheets aren't set up yet — run supabase/match_sheets.sql." };
    }
    if (error) return { error: error.message };

    refresh(fixtureId);
    return {};
  } catch (err: any) {
    return { error: err?.message ?? "Could not save the sheet." };
  }
}

/** Takes a sheet off a match. The federation only; the file itself is kept. */
export async function removeMatchDocument(
  fixtureId: string,
  documentId: string
): Promise<{ error?: string }> {
  try {
    await requireFederation();
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("fixture_documents")
      .delete()
      .eq("document_id", documentId)
      .eq("fixture_id", fixtureId);
    if (error) return { error: error.message };
    refresh(fixtureId);
    return {};
  } catch (err: any) {
    return { error: err?.message ?? "Could not remove the sheet." };
  }
}
