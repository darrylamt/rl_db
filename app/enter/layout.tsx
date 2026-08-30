import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/auth";

// /enter forms read live data from Supabase on mount — no point prerendering.
export const dynamic = "force-dynamic";

export default async function EnterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The middleware already turns the wrong account away. This is the check
  // that actually counts: a redirect is a convenience, and anyone can skip a
  // convenience.
  const user = await getAppUser();
  if (!user) redirect("/admin/login?next=/enter");
  if (user.role === "club") redirect("/club");
  if (!user.provisioned || (user.role !== "recorder" && user.role !== "federation")) {
    redirect("/admin/no-access");
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Ghana flag accent strip */}
      <div className="flex h-1 w-full">
        <div className="flex-1 bg-ghanaRed-500" />
        <div className="flex-1 bg-ghanaYellow-500" />
        <div className="flex-1 bg-ghanaGreen-500" />
      </div>
      <header className="bg-neutral-950 border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <Link href="/enter" className="flex items-baseline gap-2">
            <span className="font-display text-ghanaYellow-500 text-sm tracking-widest">
              RLFG
            </span>
            <span className="text-slate-300 text-xs">Match Day Entry</span>
          </Link>
          <nav className="flex items-center gap-3 text-xs">
            <Link href="/enter/result" className="text-slate-300 hover:text-ghanaYellow-500">
              Result
            </Link>
            <Link href="/enter/events" className="text-slate-300 hover:text-ghanaYellow-500">
              Events
            </Link>
            <Link href="/enter/fixture" className="text-slate-300 hover:text-ghanaYellow-500">
              Fixture
            </Link>
            <form action="/admin/logout" method="post">
              <button className="text-slate-500 hover:text-white border-l border-white/10 pl-3">
                Sign out
              </button>
            </form>
          </nav>
        </div>
        <div className="max-w-2xl mx-auto px-4 pb-2 -mt-1">
          <p className="text-[11px] text-slate-500">
            Signed in as {user.email ?? "this account"}
            {user.role === "federation" ? " · federation" : " · recorder"}
          </p>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6 md:py-8">{children}</main>
    </div>
  );
}
