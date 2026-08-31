import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/auth";
import Image from "next/image";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/player", label: "My profile" },
  { href: "/player/transfers", label: "Transfers" },
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

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Ghana flag strip, as on the live pages */}
      <div className="flex h-1 w-full">
        <div className="flex-1 bg-ghanaRed-500" />
        <div className="flex-1 bg-ghanaYellow-500" />
        <div className="flex-1 bg-ghanaGreen-500" />
      </div>
      <header className="bg-neutral-950 border-b border-white/10">
        {/* The federation's mark, not the player's. Their name and photo lead
            the page itself, and saying both twice on one screen wastes the
            room a phone does not have. */}
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/player" className="flex items-center gap-2.5 min-w-0 flex-1">
            <Image
              src="/federationlogo.png"
              alt=""
              width={32}
              height={32}
              className="rounded shrink-0"
            />
            <span className="min-w-0">
              <span className="block font-display text-ghanaYellow-500 text-sm tracking-widest leading-none">
                RLFG
              </span>
              <span className="block text-slate-400 text-[11px] leading-tight mt-0.5 truncate">
                Player Account
              </span>
            </span>
          </Link>
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
