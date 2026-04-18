import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/officials", label: "Officials" },
  { href: "/admin/competitions", label: "Competitions" },
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
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-60 bg-navy-900 text-white flex flex-col shrink-0">
        <div className="px-6 py-6 border-b border-navy-700">
          <p className="text-gold-400 font-display tracking-[0.15em] text-xs">
            GRLF
          </p>
          <h2 className="font-display text-lg font-bold mt-1">Admin</h2>
        </div>
        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-6 py-2.5 text-sm text-navy-100 hover:bg-navy-800 hover:text-gold-400 border-l-2 border-transparent hover:border-gold-400 transition"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-navy-700 text-xs text-navy-300">
          <div className="truncate mb-2">{user?.email}</div>
          <form action="/admin/logout" method="post">
            <button
              type="submit"
              className="text-gold-400 hover:text-gold-300 text-xs"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
