"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function str(fd: FormData, k: string) {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  return v.trim() || null;
}
function intOrNull(fd: FormData, k: string) {
  const v = str(fd, k);
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

function payload(fd: FormData) {
  return {
    name: str(fd, "name"),
    region: str(fd, "region"),
    city: str(fd, "city"),
    capacity: intOrNull(fd, "capacity"),
  };
}

export async function createVenue(fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd);
  if (!p.name) throw new Error("Name is required");
  const { error } = await supabase.from("venues").insert(p);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/venues");
  revalidatePath("/admin/teams");
}

export async function updateVenue(id: string, fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd);
  if (!p.name) throw new Error("Name is required");
  const { error } = await supabase.from("venues").update(p).eq("venue_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/venues");
  revalidatePath(`/admin/venues/${id}`);
}

export async function deleteVenue(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("venues").delete().eq("venue_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/venues");
}
