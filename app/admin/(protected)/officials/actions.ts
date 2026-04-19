"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
    region: str(fd, "region"),
    nationality: str(fd, "nationality"),
    date_of_birth: str(fd, "date_of_birth"),
    photo_url: str(fd, "photo_url"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    status: str(fd, "status") ?? "active",
  };
}

export async function createOfficial(fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd);
  if (!p.first_name || !p.last_name) throw new Error("First and last name are required");
  const { error } = await supabase.from("officials").insert(p);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/officials");
  revalidatePath("/admin/dashboard");
}

export async function updateOfficial(id: string, fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd);
  if (!p.first_name || !p.last_name) throw new Error("First and last name are required");
  const { error } = await supabase.from("officials").update(p).eq("official_id", id);
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
