"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Governance groups shown on the website. Match officials are separate,
// under /admin/officials.
export const PERSON_GROUPS = ["board", "committee"];

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
  return {
    name: str(fd, "name"),
    role: str(fd, "role"),
    email: str(fd, "email"),
    photo_url: str(fd, "photo_url"),
    group_name: str(fd, "group_name") ?? "board",
    sort_order: intOrZero(fd, "sort_order"),
    status: str(fd, "status") ?? "active",
  };
}

function validate(p: ReturnType<typeof payload>) {
  if (!p.name) throw new Error("Name is required");
  if (!PERSON_GROUPS.includes(p.group_name)) throw new Error("Pick a group");
}

export async function createPerson(fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd);
  validate(p);
  const { error } = await supabase.from("people").insert(p);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/people");
}

export async function updatePerson(id: string, fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd);
  validate(p);
  const { error } = await supabase.from("people").update(p).eq("person_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/people");
  revalidatePath("/admin/people/" + id);
}

export async function deletePerson(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("people").delete().eq("person_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/people");
}
