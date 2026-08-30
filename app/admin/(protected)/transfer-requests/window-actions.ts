"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireFederation, getAppUser } from "@/lib/auth";

const PAGE = "/admin/transfer-requests";

function describe(message: string) {
  if (/transfer_settings|transfer_windows/.test(message) && /does not exist|relation/i.test(message)) {
    return "Run supabase/transfer_window.sql first.";
  }
  if (/a_window_must_end_after_it_starts/.test(message)) {
    return "A window has to close on or after the day it opens.";
  }
  return message;
}

function done(outcome: { error: string } | { note: string }) {
  revalidatePath(PAGE);
  revalidatePath("/club/transfers");
  redirect(`${PAGE}?${new URLSearchParams(outcome as any)}`);
}

/**
 * Sets the switch.
 *
 * 'follow' is not a third state so much as the absence of the other two: the
 * dates take over again, and nobody has to remember to undo an override by
 * editing a window.
 */
export async function setTransferMode(mode: string) {
  await requireFederation();
  const user = await getAppUser();

  if (!["follow", "open", "closed"].includes(mode)) {
    done({ error: "Unknown setting." });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("transfer_settings")
    .update({
      mode,
      updated_by: user?.userId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("only_row", true);

  done(
    error
      ? { error: describe(error.message) }
      : {
          note:
            mode === "open"
              ? "The market is open, whatever the dates say."
              : mode === "closed"
              ? "The market is shut, whatever the dates say."
              : "Back to the dates — the windows decide from now on.",
        }
  );
}

/** Adds a window the market will open and close on by itself. */
export async function addTransferWindow(fd: FormData) {
  await requireFederation();
  const supabase = createAdminClient();

  const name = ((fd.get("name") as string) ?? "").trim();
  const opens = ((fd.get("opens_on") as string) ?? "").trim();
  const closes = ((fd.get("closes_on") as string) ?? "").trim();
  const season = ((fd.get("season") as string) ?? "").trim() || null;

  if (!name || !opens || !closes) {
    done({ error: "A window needs a name and both dates." });
  }

  const { error } = await supabase
    .from("transfer_windows")
    .insert({ name, opens_on: opens, closes_on: closes, season });

  done(
    error
      ? { error: describe(error.message) }
      : { note: `${name} runs from ${opens} to ${closes}.` }
  );
}

/** Removes a window. Requests already made are not affected. */
export async function removeTransferWindow(windowId: string) {
  await requireFederation();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("transfer_windows")
    .delete()
    .eq("window_id", windowId);

  done(error ? { error: describe(error.message) } : { note: "Window removed." });
}
