"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { resolveImageUrl } from "@/lib/upload";
import { getAppUser } from "@/lib/auth";

const CATEGORIES = new Set(["federation_staff", "team_staff", "medical", "media", "volunteer"]);

function str(fd: FormData, k: string) {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  return v.trim() || null;
}

/** Accreditations are the federation's to give; checked here, not just in the layout. */
async function federationOnly() {
  const user = await getAppUser();
  if (!user || user.role !== "federation" || !user.provisioned || user.onHold) {
    throw new Error("Only the federation can issue accreditations");
  }
}

function payload(fd: FormData) {
  const category = str(fd, "category") ?? "team_staff";
  return {
    full_name: str(fd, "full_name"),
    role: str(fd, "role"),
    category: CATEGORIES.has(category) ? category : "team_staff",
    team_id: str(fd, "team_id"),
    organisation: str(fd, "organisation"),
    valid_until: str(fd, "valid_until"),
    status: str(fd, "status") === "revoked" ? "revoked" : "active",
    updated_at: new Date().toISOString(),
  };
}

export async function createAccreditation(fd: FormData) {
  await federationOnly();
  const p = payload(fd);
  if (!p.full_name || !p.role) throw new Error("Name and role are required");
  const photo_url = await resolveImageUrl(fd, "photo", "player-photos", "accreditations", null);
  const { error } = await createAdminClient().from("accreditations").insert({ ...p, photo_url });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/id-cards");
}

export async function updateAccreditation(id: string, fd: FormData) {
  await federationOnly();
  const p = payload(fd);
  if (!p.full_name || !p.role) throw new Error("Name and role are required");
  const supabase = createAdminClient();
  // A save that didn't touch the photo keeps the one already stored.
  const { data: existing } = await supabase.from("accreditations").select("photo_url").eq("accreditation_id", id).maybeSingle();
  const photo_url = await resolveImageUrl(fd, "photo", "player-photos", "accreditations", existing?.photo_url);
  const { error } = await supabase.from("accreditations").update({ ...p, photo_url }).eq("accreditation_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/id-cards");
  revalidatePath(`/admin/accreditations/${id}`);
}
