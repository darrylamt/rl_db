"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DOCUMENT_TYPES } from "@/lib/contentTypes";


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
    type: str(fd, "type") ?? "Reports",
    link: str(fd, "link"),
    thumbnail_url: str(fd, "thumbnail_url"),
    published_at: str(fd, "published_at"),
    sort_order: intOrZero(fd, "sort_order"),
    status: str(fd, "status") ?? "published",
  };
}

function validate(p: ReturnType<typeof payload>) {
  if (!p.name) throw new Error("Name is required");
  if (!DOCUMENT_TYPES.includes(p.type)) throw new Error("Pick a document type");
}

export async function createDocument(fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd);
  validate(p);
  const { error } = await supabase.from("documents").insert(p);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/documents");
}

export async function updateDocument(id: string, fd: FormData) {
  const supabase = createAdminClient();
  const p = payload(fd);
  validate(p);
  const { error } = await supabase.from("documents").update(p).eq("document_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/documents");
  revalidatePath("/admin/documents/" + id);
}

export async function deleteDocument(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("documents").delete().eq("document_id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/documents");
}
