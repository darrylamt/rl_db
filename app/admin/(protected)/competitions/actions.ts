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
    name: str(fd, "name"),
    season: str(fd, "season"),
    type: str(fd, "type"),
    status: str(fd, "status") ?? "upcoming",
    start_date: str(fd, "start_date"),
    end_date: str(fd, "end_date"),
    // Public address on the website: /competitions/<slug>
    slug: slugify(str(fd, "slug")),
    logo_url: str(fd, "logo_url"),
    banner_url: str(fd, "banner_url"),
  };
}

/** Keep slugs URL-safe without silently changing what was typed. */
function slugify(v: string | null) {
  if (!v) return null;
  return v.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || null;
}

export async function createCompetition(fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd);
  if (!p.name) throw new Error("Name is required");
  const { error } = await supabase.from("competitions").insert(p);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/competitions");
}

export async function updateCompetition(id: string, fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd);
  if (!p.name) throw new Error("Name is required");
  const { error } = await supabase.from("competitions").update(p).eq("competition_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/competitions");
  revalidatePath(`/admin/competitions/${id}`);
}

export async function deleteCompetition(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("competitions").delete().eq("competition_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/competitions");
}
