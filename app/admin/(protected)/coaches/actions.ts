"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { requireFederation } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { resolveImageUrl } from "@/lib/upload";

function str(fd: FormData, k: string) {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  return v.trim() || null;
}

function payload(fd: FormData) {
  return {
    first_name: str(fd, "first_name"),
    last_name: str(fd, "last_name"),
    // Blank means any club may name them, which is why this is not defaulted.
    team_id: str(fd, "team_id"),
    role: str(fd, "role"),
    qualification: str(fd, "qualification"),
    region: str(fd, "region"),
    nationality: str(fd, "nationality"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    status: str(fd, "status") ?? "active",
  };
}

export async function createCoach(fd: FormData) {
  await requireFederation();
  const supabase = createAdminClient();
  const p = payload(fd);
  if (!p.first_name || !p.last_name) {
    throw new Error("First and last name are required");
  }
  // A new coach has no photo to keep, so anything absent stays null.
  const photo_url = await resolveImageUrl(
    fd,
    "photo",
    "player-photos",
    "coaches",
    null
  );
  const { error } = await supabase.from("coaches").insert({ ...p, photo_url });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/coaches");
}

export async function updateCoach(id: string, fd: FormData) {
  await requireFederation();
  const supabase = createAdminClient();
  const p = payload(fd);
  if (!p.first_name || !p.last_name) {
    throw new Error("First and last name are required");
  }

  // An empty file input is not a request to remove the photo. Reading what is
  // already stored and handing it back is what stops a save that did not
  // touch the picture from wiping it — the bug that ate club photos before.
  const { data: existing } = await supabase
    .from("coaches")
    .select("photo_url")
    .eq("coach_id", id)
    .maybeSingle();

  const photo_url = await resolveImageUrl(
    fd,
    "photo",
    "player-photos",
    "coaches",
    (existing as any)?.photo_url
  );

  const { error } = await supabase
    .from("coaches")
    .update({ ...p, photo_url })
    .eq("coach_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/coaches");
  revalidatePath(`/admin/coaches/${id}`);
}

/**
 * Removes a coach from the register.
 *
 * Refused once they have taken charge of a match. The team sheet would keep
 * the row and lose the name, which is a worse record than an inactive coach
 * nobody can pick any more — that is what the status is for.
 */
export async function deleteCoach(id: string) {
  await requireFederation();
  const supabase = createAdminClient();

  const { count } = await supabase
    .from("team_sheets")
    .select("sheet_id", { count: "exact", head: true })
    .or(`head_coach_id.eq.${id},assistant_coach_id.eq.${id}`);

  if ((count ?? 0) > 0) {
    throw new Error(
      `This coach is on ${count} team sheet${count === 1 ? "" : "s"}. Set them to inactive instead — deleting would leave those matches with no name against them.`
    );
  }

  const { error } = await supabase.from("coaches").delete().eq("coach_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/coaches");
}
