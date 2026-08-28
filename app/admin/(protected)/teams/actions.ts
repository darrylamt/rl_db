"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { resolveImageUrl } from "@/lib/upload";
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

const TEAM_TYPES = ["club", "national", "president_xv"] as const;
type TeamType = (typeof TEAM_TYPES)[number];

function teamType(fd: FormData): TeamType {
  const v = str(fd, "team_type");
  return (TEAM_TYPES as readonly string[]).includes(v ?? "")
    ? (v as TeamType)
    : "club";
}

function payloadFromForm(fd: FormData) {
  return {
    name: str(fd, "name"),
    team_type: teamType(fd),
    region: str(fd, "region"),
    city: str(fd, "city"),
    founded_year: intOrNull(fd, "founded_year"),
    home_venue_id: str(fd, "home_venue_id"),
    manager_name: str(fd, "manager_name"),
    coach_name: str(fd, "coach_name"),
    // Slug is the club's public URL on the website (/clubs/panthers), so it is
    // a deliberate short name rather than something derived from the name.
    slug: slugify(str(fd, "slug")),
    legal_name: str(fd, "legal_name"),
    instagram_url: str(fd, "instagram_url"),
    is_public: fd.get("is_public") === "on",
    logo_url: null as string | null,
  };
}

/** Keep slugs URL-safe without silently changing what was typed. */
function slugify(v: string | null) {
  if (!v) return null;
  return v.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || null;
}

export async function createTeam(fd: FormData) {
  const supabase = createAdminClient();
  const payload = payloadFromForm(fd);
  if (!payload.name) throw new Error("Name is required");
  payload.logo_url = await resolveImageUrl(fd, "logo", "team-logos", "teams", null);
  const { error } = await supabase.from("teams").insert(payload);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/teams");
  revalidatePath("/admin/dashboard");
}

export async function updateTeam(id: string, fd: FormData) {
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("teams")
    .select("logo_url")
    .eq("team_id", id)
    .maybeSingle();
  const payload = payloadFromForm(fd);
  if (!payload.name) throw new Error("Name is required");
  payload.logo_url = await resolveImageUrl(fd, "logo", "team-logos", "teams", existing?.logo_url);
  const { error } = await supabase.from("teams").update(payload).eq("team_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/teams");
  revalidatePath(`/admin/teams/${id}`);
}

export async function deleteTeam(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("teams").delete().eq("team_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/teams");
}
