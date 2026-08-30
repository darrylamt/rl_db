"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/Avatar";

type Item = { href: string; label: string; badge?: number };

/**
 * The club portal's navigation.
 *
 * A row of links that scrolls sideways works until there are five of them,
 * and then the ones off the right-hand edge may as well not exist — nothing
 * says there is more. It behaves like the federation's now: a drawer behind
 * a button on a phone, the full list on a wider screen.
 */
export function ClubNav({
  items,
  clubName,
  logoUrl,
}: {
  items: Item[];
  clubName: string;
  logoUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Whatever you tapped, you are going there — the drawer has done its job.
  useEffect(() => setOpen(false), [pathname]);

  // Nothing behind the drawer should scroll while it is over the page.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isHere = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  const Row = ({ item, drawer }: { item: Item; drawer?: boolean }) => (
    <Link
      href={item.href}
      className={
        drawer
          ? `flex items-center justify-between px-6 py-3 text-sm border-l-2 ${
              isHere(item.href)
                ? "bg-navy-800 text-gold-400 border-gold-400"
                : "text-navy-100 border-transparent hover:bg-navy-800 hover:text-gold-400"
            }`
          : `px-3 py-2 text-sm rounded-t whitespace-nowrap border-b-2 ${
              isHere(item.href)
                ? "text-white border-gold-400 font-medium"
                : "text-navy-100 border-transparent hover:text-white hover:bg-white/5"
            }`
      }
    >
      <span>{item.label}</span>
      {!!item.badge && item.badge > 0 && (
        <span className="ml-2 bg-gold-500 text-navy-900 text-[10px] font-bold rounded-full min-w-[1.15rem] h-[1.15rem] px-1 inline-flex items-center justify-center tabular-nums">
          {item.badge}
        </span>
      )}
    </Link>
  );

  const waiting = items.reduce((n, i) => n + (i.badge ?? 0), 0);

  return (
    <>
      {/* Phone: the club, a menu button, and nothing else competing */}
      <div className="md:hidden max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
        <Avatar src={logoUrl} name={clubName} size={36} />
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold leading-tight truncate">{clubName}</p>
          <p className="text-[11px] text-navy-200">Club portal</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="relative p-2 -mr-2 text-white"
        >
          {open ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              {/* Something waiting inside a shut menu has to show on the outside. */}
              {waiting > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-gold-500" />
              )}
            </>
          )}
        </button>
      </div>

      {open && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav
        className={`md:hidden fixed inset-y-0 right-0 z-40 w-64 bg-navy-900 border-l border-navy-700 transform transition-transform duration-200 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <div className="px-6 py-4 border-b border-navy-700">
          <p className="font-display font-bold truncate">{clubName}</p>
          <p className="text-[11px] text-navy-300">Club portal</p>
        </div>
        <div className="py-2 flex-1 overflow-y-auto">
          {items.map((i) => (
            <Row key={i.href} item={i} drawer />
          ))}
        </div>
        <form action="/admin/logout" method="post" className="p-4 border-t border-navy-700">
          <button className="w-full text-navy-200 hover:text-white text-sm border border-white/15 rounded px-3 py-2">
            Sign out
          </button>
        </form>
      </nav>

      {/* Wider screens keep the whole list in view */}
      <div className="hidden md:block">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Avatar src={logoUrl} name={clubName} size={36} />
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold leading-tight truncate">{clubName}</p>
            <p className="text-[11px] text-navy-200">Club portal</p>
          </div>
          <form action="/admin/logout" method="post">
            <button className="text-navy-200 hover:text-white text-xs border border-white/15 rounded px-2.5 py-1">
              Sign out
            </button>
          </form>
        </div>
        <nav className="max-w-5xl mx-auto px-2 flex gap-1">
          {items.map((i) => (
            <Row key={i.href} item={i} />
          ))}
        </nav>
      </div>
    </>
  );
}
