import { redirect } from "next/navigation";

/**
 * The front door is the live scores.
 *
 * This was a landing page describing the platform, with links onward to the
 * match centre and the admin. Nobody arriving at the root wants a menu —
 * the public are here for a score, and everyone else has a bookmark or a
 * link they were given. /live is what they came for, so it is what they get.
 *
 * A redirect rather than moving the page: /live and /live/<id> are already
 * linked to from elsewhere, and those links keep working unchanged.
 */
export default function Home() {
  redirect("/live");
}
