import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

// Admin pages are per-user (authed) and pull live data — never prerender.
export const dynamic = "force-dynamic";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/articles", label: "Articles" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/registrations", label: "Registrations" },
  { href: "/admin/player-approvals", label: "Player Approvals" },
  { href: "/admin/team-sheets", label: "Team Sheets" },
  { href: "/admin/player-history", label: "Club History" },
  { href: "/admin/transfers", label: "Transfers" },
  { href: "/admin/club-accounts", label: "Club Accounts" },
  { href: "/admin/recorders", label: "Match Recorders" },
  { href: "/admin/officials", label: "Officials" },
  { href: "/admin/competitions", label: "Competitions" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/fixtures", label: "Fixtures" },
  { href: "/admin/results", label: "Results" },
  { href: "/admin/standings", label: "Standings" },
  { href: "/admin/suspensions", label: "Suspensions" },
  { href: "/admin/documents", label: "Documents", divider: true },
  { href: "/admin/people", label: "Board & Committee" },
  { href: "/admin/partners", label: "Partners" },
  { href: "/admin/audit", label: "Audit Trail" },
  { href: "/docs", label: "API Docs", divider: true, external: true },
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

  return (
    <div className="min-h-screen md:flex bg-slate-50">
      <AdminSidebar items={navItems} email={user.email ?? undefined} />
      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}
