import { redirect } from "next/navigation";

/**
 * A short address to hand out.
 *
 * Clubs and match-day recorders get told where to sign in verbally, often
 * over a phone. /login is what people try; sending them on beats a 404.
 */
export default function LoginAlias({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const next = searchParams?.next;
  redirect(next ? `/admin/login?next=${encodeURIComponent(next)}` : "/admin/login");
}
