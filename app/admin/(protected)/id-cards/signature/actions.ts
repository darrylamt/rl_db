"use server";

import { revalidatePath } from "next/cache";
import { getAppUser } from "@/lib/auth";
import { r2Put } from "@/lib/r2";
import { cleanSignature, getSignatory, saveSignatory } from "@/lib/signature";

/**
 * Saves the General Manager's signature, name and title. A new picture is
 * cleaned (paper removed) and stored under a new name, so cards printed
 * from now on use it; saving without a picture just updates the name.
 */
export async function saveSignature(fd: FormData): Promise<{ ok: boolean; error?: string }> {
  const user = await getAppUser();
  if (!user || user.role !== "federation" || !user.provisioned || user.onHold) {
    return { ok: false, error: "Only the federation can set the signature" };
  }
  const name = String(fd.get("name") ?? "").trim();
  const title = String(fd.get("title") ?? "").trim() || "General Manager";
  if (!name) return { ok: false, error: "Enter the signatory's name" };

  const current = await getSignatory();
  let url = current?.url ?? "";
  const file = fd.get("signature");
  if (file && typeof file !== "string" && file.size > 0) {
    try {
      const png = await cleanSignature(Buffer.from(await file.arrayBuffer()));
      url = await r2Put(`content-images/branding/gm-signature-${Date.now()}.png`, png, "image/png");
    } catch (e: any) {
      return { ok: false, error: "That picture couldn't be read. Try a clear photo of the signature on white paper." };
    }
  }
  if (!url) return { ok: false, error: "Choose a picture of the signature" };

  await saveSignatory({ url, name, title });
  revalidatePath("/admin/id-cards/signature");
  return { ok: true };
}
