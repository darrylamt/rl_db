import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

// Admin pages are per-user (authed) and pull live data — never prerender.
export const dynamic = "force-dynamic";

// Pinned above the sections: the two you reach for constantly.
const navItems = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/fixtures", label: "Fixtures" },
];

/**
 * The rest, grouped.
 *
 * Twenty-three links in one flat list had no shape: Venues, which is touched
 * twice a season, sat at the same weight as Results. Grouping puts the work
 * you do weekly above the setup you did once, and the two queues carry a
 * count so you stop having to go and look.
 */
const navSections = [
  {
    title: "Match day",
    items: [
      { href: "/admin/team-sheets", label: "Team Sheets" },
      { href: "/admin/results", label: "Results" },
      { href: "/admin/standings", label: "Standings" },
    ],
  },
  {
    title: "Players",
    items: [
      { href: "/admin/players", label: "Players" },
      { href: "/admin/player-approvals", label: "Player Approvals" },
      { href: "/admin/registrations", label: "Registrations" },
      { href: "/admin/transfer-requests", label: "Transfer Requests" },
      { href: "/admin/transfers", label: "Transfers" },
      { href: "/admin/player-history", label: "Club History" },
      { href: "/admin/suspensions", label: "Suspensions" },
    ],
  },
  {
    title: "Credits",
    items: [{ href: "/admin/credits", label: "Club Credits" }],
  },
  {
    title: "Clubs & people",
    items: [
      { href: "/admin/teams", label: "Teams" },
      { href: "/admin/club-accounts", label: "Club Accounts" },
      { href: "/admin/recorders", label: "Match Recorders" },
      { href: "/admin/officials", label: "Officials" },
    ],
  },
  {
    title: "Competition setup",
    items: [
      { href: "/admin/competitions", label: "Competitions" },
      { href: "/admin/venues", label: "Venues" },
    ],
  },
  {
    title: "Public site",
    items: [
      { href: "/admin/articles", label: "Articles" },
      { href: "/admin/documents", label: "Documents" },
      { href: "/admin/people", label: "Board & Committee" },
      { href: "/admin/partners", label: "Partners" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/audit", label: "Audit Trail" },
      { href: "/docs", label: "API Docs", external: true },
    ],
  },
];


export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The middleware routes each role to its own side of the app. This is the
  // check that holds, the same way /club and /enter check for themselves.
  const user = await getAppUser();
  if (!user) redirect("/admin/login?next=/admin/dashboard");
  if (user.onHold) redirect("/admin/on-hold");
  if (user.role === "club") redirect("/club");
  if (user.role === "recorder") redirect("/enter");
  if (!user.provisioned) redirect("/admin/no-access");

  // What is actually waiting. Counted here so the queues carry a number
  // rather than needing a visit to find out they are empty. Both degrade to
  // no badge if their migration has not been run.
  const supabase = createAdminClient();
  const [pendingPlayers, pendingSheets, pendingTransfers] = await Promise.all([
    supabase
      .from("players")
      .select("player_id", { count: "exact", head: true })
      .eq("approval_status", "pending"),
    supabase
      .from("team_sheets")
      .select("sheet_id", { count: "exact", head: true })
      .eq("status", "submitted"),
    supabase
      .from("transfer_requests")
      .select("request_id", { count: "exact", head: true })
      .eq("status", "with_federation"),
  ]);

  const badges: Record<string, number> = {
    "/admin/player-approvals": pendingPlayers.count ?? 0,
    "/admin/team-sheets": pendingSheets.count ?? 0,
    "/admin/transfer-requests": pendingTransfers.count ?? 0,
  };

  const sections = navSections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({
      ...item,
      badge: badges[item.href] || undefined,
    })),
  }));

  return (
    <div className="min-h-screen md:flex bg-slate-50">
      <AdminSidebar items={navItems} sections={sections} email={user.email ?? undefined} />
      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}
