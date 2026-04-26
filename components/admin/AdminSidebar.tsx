"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

export function AdminSidebar({
  items,
  email,
}: {
  items: NavItem[];
  email: string | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while drawer is open on mobile.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Mobile top bar — visible below md */}
      <div className="md:hidden sticky top-0 z-30 bg-navy-900 text-white border-b border-navy-700 flex items-center justify-between px-4 h-14">
        <Link href="/admin/dashboard" className="flex items-center gap-2">
          <Image src="/federationlogo.png" alt="RLFG" width={32} height={32} className="rounded" />
          <span className="font-display text-sm font-bold">Admin</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="p-2 -mr-2 text-white"
        >
          {open ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Backdrop for mobile drawer */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — static on md+, drawer on mobile */}
      <aside
        className={[
          "bg-navy-900 text-white flex flex-col shrink-0 z-40",
          "fixed inset-y-0 left-0 w-64 transform transition-transform duration-200 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
          "md:static md:w-60 md:transform-none md:transition-none",
        ].join(" ")}
      >
        <div className="px-6 py-5 border-b border-navy-700 hidden md:flex items-center gap-3">
          <Image src="/federationlogo.png" alt="RLFG" width={40} height={40} className="rounded shrink-0" />
          <div>
            <p className="text-gold-400 font-display tracking-[0.15em] text-xs leading-none">RLFG</p>
            <h2 className="font-display text-base font-bold mt-0.5">Admin</h2>
          </div>
        </div>

        {/* Mobile-only top of drawer (aligns with the sticky 56px bar) */}
        <div className="px-6 py-4 border-b border-navy-700 md:hidden flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/federationlogo.png" alt="RLFG" width={32} height={32} className="rounded" />
            <h2 className="font-display text-lg font-bold">Admin</h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="p-2 -mr-2 text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "block px-6 py-2.5 text-sm border-l-2 transition",
                  active
                    ? "bg-navy-800 text-gold-400 border-gold-400"
                    : "text-navy-100 border-transparent hover:bg-navy-800 hover:text-gold-400 hover:border-gold-400",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-6 py-4 border-t border-navy-700 text-xs text-navy-300">
          <div className="truncate mb-2">{email}</div>
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
    </>
  );
}
