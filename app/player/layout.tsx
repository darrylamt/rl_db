import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/player", label: "My profile" },
  { href: "/player/availability", label: "Availability" },
];

export default async function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAppUser();

  // The middleware sorts the traffic; this is the check that holds.
  if (!user) redirect("/admin/login?next=/player");
  if (user.onHold) redirect("/admin/on-hold");
  if (user.role !== "player" || !user.playerId) redirect("/admin/dashboard");

  const supabase = createAdminClient();
  const { data: player } = await supabase
    .from("players")
    .select("first_name, last_name, photo_url, position, team:team_id(name)")
    .eq("player_id", user.playerId)
    .maybeSingle();

  const p = player as any;
  const name = `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || "Player";

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Ghana flag strip, as on the live pages */}
      <div className="flex h-1 w-full">
        <div className="flex-1 bg-ghanaRed-500" />
        <div className="flex-1 bg-ghanaYellow-500" />
        <div className="flex-1 bg-ghanaGreen-500" />
      </div>
      <header className="bg-neutral-950 border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Avatar src={p?.photo_url} name={name} size={38} />
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold leading-tight truncate">{name}</p>
            <p className="text-[11px] text-slate-400 truncate">
              {[p?.team?.name, p?.position].filter(Boolean).join(" · ") || "Player"}
            </p>
          </div>
          <form action="/admin/logout" method="post">
            <button className="text-slate-400 hover:text-white text-xs border border-white/15 rounded px-2.5 py-1">
              Sign out
            </button>
          </form>
        </div>
        <nav className="max-w-3xl mx-auto px-2 flex gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="px-3 py-2 text-sm text-slate-300 hover:text-ghanaYellow-500 hover:bg-white/5 rounded-t whitespace-nowrap"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 min-w-0 overflow-x-hidden">
        {children}
      </main>

      <footer className="max-w-3xl mx-auto px-4 pb-8 text-xs text-slate-500">
        Everything here is yours to read. Your club and the federation keep it
        up to date — the two things you decide are your contracts and whether
        you are available.
      </footer>
    </div>
  );
}
