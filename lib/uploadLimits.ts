/**
 * How big an upload may be, so the R2 allowance (10 GB free) lasts.
 *
 * Pictures are shrunk on the way in (see shrinkImage / shrinkImageInBrowser),
 * so a 10 MB phone photo is stored at a few hundred KB; the limit only stops
 * something absurd. Documents can't be shrunk, so theirs is the real cap.
 */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // before shrinking
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

/** Longest side a stored picture keeps. */
export const MAX_IMAGE_SIDE = 1600;

const SHRINKABLE = /^image\/(jpeg|jpg|png|webp|heic|heif|avif)$/i;

export function isShrinkableImage(type: string | null | undefined): boolean {
  return SHRINKABLE.test(type ?? "");
}

/** Null when the size is fine, otherwise the reason to show. */
export function uploadTooBig(size: number, type: string | null | undefined): string | null {
  const image = (type ?? "").startsWith("image/");
  const max = image ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
  if (size <= max) return null;
  const mb = (n: number) => `${Math.round(n / 1024 / 1024)} MB`;
  return `That file is ${mb(size)}. ${image ? "Pictures" : "Documents"} can be up to ${mb(max)}.`;
}
