"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * RLFG events, for the website's Events page and homepage. Each change is
 * recorded in the audit trail by the database trigger, like everything else.
 */

const CATEGORIES = new Set(["tournament", "clinic", "meeting", "launch", "social", "other"]);
const STATUSES = new Set(["draft", "published", "cancelled"]);

function str(fd: FormData, k: string) {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  return v.trim() || null;
}

function payload(fd: FormData) {
  const category = str(fd, "category") ?? "other";
  const status = str(fd, "status") ?? "published";
  return {
    title: str(fd, "title"),
    category: CATEGORIES.has(category) ? category : "other",
    starts_on: str(fd, "starts_on"),
    start_time: str(fd, "start_time"),
    ends_on: str(fd, "ends_on"),
    venue: str(fd, "venue"),
    summary: str(fd, "summary"),
    details: str(fd, "details"),
    image_url: str(fd, "image_url"),
    link: str(fd, "link"),
    status: STATUSES.has(status) ? status : "published",
    updated_at: new Date().toISOString(),
  };
}

function validate(p: ReturnType<typeof payload>) {
  if (!p.title) throw new Error("A title is required");
  if (!p.starts_on) throw new Error("A start date is required");
  if (p.ends_on && p.ends_on < p.starts_on) throw new Error("It can't end before it starts");
  if (p.link && !/^https?:\/\//i.test(p.link)) throw new Error("The link must start with http:// or https://");
}

function missingTable(error: any) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

function refresh(id?: string) {
  revalidatePath("/admin/events");
  if (id) revalidatePath(`/admin/events/${id}`);
}

export async function createEvent(fd: FormData) {
  const p = payload(fd);
  validate(p);
  const { error } = await createAdminClient().from("federation_events").insert(p);
  if (missingTable(error)) throw new Error("Events aren't set up yet: run supabase/federation_events.sql.");
  if (error) throw new Error(error.message);
  refresh();
}

export async function updateEvent(id: string, fd: FormData) {
  const p = payload(fd);
  validate(p);
  const { error } = await createAdminClient().from("federation_events").update(p).eq("event_id", id);
  if (error) throw new Error(error.message);
  refresh(id);
}

export async function deleteEvent(id: string) {
  const { error } = await createAdminClient().from("federation_events").delete().eq("event_id", id);
  if (error) throw new Error(error.message);
  refresh();
}
