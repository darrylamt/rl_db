"use server";

import { createAdminClient } from "@/lib/supabase/server";
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
    role: str(fd, "role"),
    // Set by hand, never worked out from matches done: passing a course
    // happens off the field and only the federation knows when it did.
    level: str(fd, "level"),
    level_gained: str(fd, "level_gained"),
    region: str(fd, "region"),
    nationality: str(fd, "nationality"),
    date_of_birth: str(fd, "date_of_birth"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    status: str(fd, "status") ?? "active",
  };
}

export async function createOfficial(fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd);
  if (!p.first_name || !p.last_name) throw new Error("First and last name are required");
  // Uploaded and framed on the form, as a coach's or a player's photo is.
  const photo_url = await resolveImageUrl(fd, "photo", "player-photos", "officials", null);
  const { error } = await supabase.from("officials").insert({ ...p, photo_url });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/officials");
  revalidatePath("/admin/dashboard");
}

export async function updateOfficial(id: string, fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd);
  if (!p.first_name || !p.last_name) throw new Error("First and last name are required");
  // A save that didn't touch the photo keeps the one already stored.
  const { data: existing } = await supabase.from("officials").select("photo_url").eq("official_id", id).maybeSingle();
  const photo_url = await resolveImageUrl(fd, "photo", "player-photos", "officials", existing?.photo_url);
  const { error } = await supabase.from("officials").update({ ...p, photo_url }).eq("official_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/officials");
  revalidatePath(`/admin/officials/${id}`);
}

export async function deleteOfficial(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("officials").delete().eq("official_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/officials");
}
