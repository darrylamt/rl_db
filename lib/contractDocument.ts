import { createAdminClient } from "@/lib/supabase/server";

export const CONTRACT_BUCKET = "contract-documents";

/** Two megabytes. A contract is text; anything bigger is an uncompressed scan. */
export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;

export function describeSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Stores the contract document.
 *
 * Checked here as well as on the bucket. The bucket's ceiling is the one
 * that cannot be got round, but it answers with a storage error nobody can
 * act on; this one can say what the limit is and what was sent.
 *
 * Replacing a document deletes the old file rather than leaving it behind.
 * Nothing points at it once the row moves on, and orphaned uploads are how a
 * storage bill grows without anybody deciding to spend anything.
 */
export async function storeContractDocument(
  contractId: string,
  file: File,
  replacing?: string | null
): Promise<{ path: string; name: string; size: number } | { error: string }> {
  if (!file || file.size === 0) return { error: "No file was chosen." };

  if (file.type !== "application/pdf") {
    return { error: "The contract has to be a PDF." };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return {
      error: `That file is ${describeSize(file.size)}. The limit is ${describeSize(
        MAX_DOCUMENT_BYTES
      )} — export it as text rather than as a scan, or compress it.`,
    };
  }

  const supabase = createAdminClient();
  const path = `${contractId}/${Date.now()}.pdf`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(CONTRACT_BUCKET)
    .upload(path, buffer, { contentType: "application/pdf", upsert: false });

  if (error) {
    return {
      error: /bucket/i.test(error.message)
        ? "Contract documents need supabase/contract_negotiation.sql to be run first."
        : error.message,
    };
  }

  if (replacing) {
    await supabase.storage.from(CONTRACT_BUCKET).remove([replacing]);
  }

  return { path, name: file.name, size: file.size };
}

/**
 * A link to read the document, good for ten minutes.
 *
 * Signed rather than public: a contract is between a club and a player, and
 * a public URL is readable by anybody who ever sees it once.
 */
export async function contractDocumentUrl(
  path: string | null | undefined
): Promise<string | null> {
  if (!path) return null;
  const supabase = createAdminClient();
  const { data } = await supabase.storage
    .from(CONTRACT_BUCKET)
    .createSignedUrl(path, 60 * 10);
  return data?.signedUrl ?? null;
}

/** Removes a document, for when a contract is withdrawn before anyone signs. */
export async function removeContractDocument(path: string | null | undefined) {
  if (!path) return;
  const supabase = createAdminClient();
  await supabase.storage.from(CONTRACT_BUCKET).remove([path]);
}
