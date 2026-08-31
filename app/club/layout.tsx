import { ClubNav } from "@/components/club/ClubNav";
import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

// Everything here is signed-in and reads live data — never prerender.
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/club", label: "Overview" },
  { href: "/club/players", label: "Squad" },
  { href: "/club/team-sheets", label: "Team Sheets" },
  { href: "/club/fixtures", label: "Fixtures" },
  { href: "/club/contracts", label: "Contracts" },
  { href: "/club/transfers", label: "Transfers" },
];

export default async function ClubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAppUser();

  // The middleware sorts the traffic; this is the check that actually holds.
  if (!user) redirect("/admin/login?next=/club");
  if (user.onHold) redirect("/admin/on-hold");
  if (user.role !== "club" || !user.teamId) redirect("/admin/dashboard");

  const supabase = createAdminClient();
  const { data: team } = await supabase
    .from("teams")
    .select("team_id, name, logo_url, division, region, city")
    .eq("team_id", user.teamId)
    .maybeSingle();

  // What is waiting on this club, so a shut menu still says there is
  // something to do. Both degrade to no badge before their migration is run.
  const [sheetsBack, incoming] = await Promise.all([
    supabase
      .from("team_sheets")
      .select("sheet_id", { count: "exact", head: true })
      .eq("team_id", user.teamId)
      .in("status", ["draft", "declined"]),
    supabase
      .from("transfer_requests")
      .select("request_id", { count: "exact", head: true })
      .eq("from_team_id", user.teamId)
      .eq("status", "with_club"),
  ]);

  const nav = NAV.map((n) => ({
    ...n,
    badge:
      n.href === "/club/team-sheets"
        ? sheetsBack.count ?? 0
        : n.href === "/club/transfers"
        ? incoming.count ?? 0
        : undefined,
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-navy-900 text-white sticky top-0 z-30">
        <ClubNav items={nav} clubName={team?.name ?? "Club"} logoUrl={team?.logo_url} />
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 min-w-0 overflow-x-hidden">{children}</main>

      <footer className="max-w-5xl mx-auto px-4 pb-8 text-xs text-slate-400">
        You can edit your own players here. Registrations, results and
        competitions stay with the federation.
      </footer>
    </div>
  );
}
