"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { writeWithOptionalColumns } from "@/lib/optionalColumns";
import { revalidatePath } from "next/cache";


function str(fd: FormData, k: string) {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  return v.trim() || null;
}
function intOrZero(fd: FormData, k: string) {
  const v = str(fd, k);
  const n = v ? parseInt(v, 10) : 0;
  return Number.isNaN(n) ? 0 : n;
}

function payload(fd: FormData) {
  const tier = intOrZero(fd, "tier") || 1;
  return {
    name: str(fd, "name"),
    link: str(fd, "link"),
    logo_url: str(fd, "logo_url"),
    designation: str(fd, "designation"),
    tier: Math.max(1, Math.min(3, tier)),
    tier_title: str(fd, "tier_title"),
    sort_order: intOrZero(fd, "sort_order"),
    status: str(fd, "status") ?? "active",
    // Null means a federation partner, which is what every existing row is.
    team_id: str(fd, "team_id"),
  };
}

// Dropped and retried if club_partners.sql has not been run yet, so the
// partners admin keeps working either way.
const OPTIONAL = ["team_id"] as const;

function validate(p: ReturnType<typeof payload>) {
  if (!p.name) throw new Error("Name is required");
}

export async function createPartner(fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd);
  validate(p);
  const { error } = await writeWithOptionalColumns(p, OPTIONAL, (values) =>
    supabase.from("partners").insert(values)
  );
  if (error) throw new Error(error.message);
  revalidatePath("/admin/partners");
}

export async function updatePartner(id: string, fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd);
  validate(p);
  const { error } = await writeWithOptionalColumns(p, OPTIONAL, (values) =>
    supabase.from("partners").update(values).eq("partner_id", id)
  );
  if (error) throw new Error(error.message);
  revalidatePath("/admin/partners");
  revalidatePath("/admin/partners/" + id);
}

export async function deletePartner(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("partners").delete().eq("partner_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/partners");
}
