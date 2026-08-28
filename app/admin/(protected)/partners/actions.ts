"use server";

import { createAdminClient } from "@/lib/supabase/server";
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
  };
}

function validate(p: ReturnType<typeof payload>) {
  if (!p.name) throw new Error("Name is required");
}

export async function createPartner(fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd);
  validate(p);
  const { error } = await supabase.from("partners").insert(p);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/partners");
}

export async function updatePartner(id: string, fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd);
  validate(p);
  const { error } = await supabase.from("partners").update(p).eq("partner_id", id);
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
