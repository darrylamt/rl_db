import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

// Everything here is signed-in and reads live data — never prerender.
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/club", label: "Overview" },
  { href: "/club/players", label: "Squad" },
  { href: "/club/fixtures", label: "Fixtures" },
];

export default async function ClubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAppUser();

  // The middleware sorts the traffic; this is the check that actually holds.
  if (!user) redirect("/admin/login?next=/club");
  if (user.role !== "club" || !user.teamId) redirect("/admin/dashboard");

  const supabase = createAdminClient();
  const { data: team } = await supabase
    .from("teams")
    .select("team_id, name, logo_url, division, region, city")
    .eq("team_id", user.teamId)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-navy-900 text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          {team?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={team.logo_url}
              alt=""
              className="w-9 h-9 rounded-full object-cover bg-white/10"
            />
          ) : (
            <span className="w-9 h-9 rounded-full bg-white/10 grid place-items-center font-display text-xs">
              {(team?.name ?? "??").slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold leading-tight truncate">
              {team?.name ?? "Club"}
            </p>
            <p className="text-[11px] text-navy-200">Club portal</p>
          </div>
          <form action="/admin/logout" method="post">
            <button
              type="submit"
              className="text-navy-200 hover:text-white text-xs border border-white/15 rounded px-2.5 py-1"
            >
              Sign out
            </button>
          </form>
        </div>

        <nav className="max-w-5xl mx-auto px-2 flex gap-1 overflow-x-auto">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="px-3 py-2 text-sm text-navy-100 hover:text-white hover:bg-white/5 rounded-t whitespace-nowrap"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>

      <footer className="max-w-5xl mx-auto px-4 pb-8 text-xs text-slate-400">
        You can edit your own players here. Registrations, results and
        competitions stay with the federation.
      </footer>
    </div>
  );
}
