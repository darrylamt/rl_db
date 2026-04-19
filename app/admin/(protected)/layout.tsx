import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

// Admin pages are per-user (authed) and pull live data — never prerender.
export const dynamic = "force-dynamic";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/officials", label: "Officials" },
  { href: "/admin/competitions", label: "Competitions" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/fixtures", label: "Fixtures" },
  { href: "/admin/results", label: "Results" },
  { href: "/admin/standings", label: "Standings" },
  { href: "/admin/suspensions", label: "Suspensions" },
];

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen md:flex bg-slate-50">
      <AdminSidebar items={navItems} email={user?.email} />
      <main className="flex-1 md:overflow-auto">{children}</main>
    </div>
  );
}
