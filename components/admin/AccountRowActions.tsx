"use client";

import { useState } from "react";

/**
 * Hold, release, reset password and revoke, folded behind one control.
 *
 * Four buttons on every row turns a short list into a wall of controls, and
 * three of these are rare — a password is reset when someone forgets it, a
 * hold goes on once a season. Only the common one stays visible.
 */
export function AccountRowActions({
  userId,
  email,
  onHold,
  heldReason,
  hold,
  release,
  resetPassword,
  revoke,
}: {
  userId: string;
  email: string;
  onHold: boolean;
  heldReason?: string | null;
  hold: (userId: string, fd: FormData) => Promise<void>;
  release: (userId: string) => Promise<void>;
  resetPassword: (userId: string, fd: FormData) => Promise<void>;
  revoke: (userId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState<null | "hold" | "password">(null);

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2 justify-end flex-wrap">
        {onHold ? (
          <form action={release.bind(null, userId)}>
            <button className="text-xs font-medium px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white">
              Release
            </button>
          </form>
        ) : (
          <button
            onClick={() => setOpen(open === "hold" ? null : "hold")}
            className="text-xs font-medium px-2.5 py-1 rounded border border-amber-300 text-amber-800 hover:bg-amber-50"
          >
            Hold
          </button>
        )}

        <button
          onClick={() => setOpen(open === "password" ? null : "password")}
          className="text-xs px-2.5 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
        >
          Password
        </button>

        <form
          action={revoke.bind(null, userId)}
          onSubmit={(e) => {
            if (
              !confirm(
                `Remove ${email}'s login for good? They will be signed out and cannot sign in again. To stop them temporarily, use Hold instead.`
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <button className="text-xs px-2.5 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50">
            Revoke
          </button>
        </form>
      </div>

      {onHold && heldReason && (
        <p className="text-[11px] text-amber-700 text-right max-w-[16rem]">
          On hold — {heldReason}
        </p>
      )}

      {open === "hold" && (
        <form action={hold.bind(null, userId)} className="flex gap-1.5 items-center">
          <input
            name="reason"
            placeholder="why? e.g. 2026 fees unpaid"
            className="text-xs px-2 py-1 rounded border border-slate-300 w-52"
          />
          <button className="text-xs font-medium px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white">
            Put on hold
          </button>
        </form>
      )}

      {open === "password" && (
        <form action={resetPassword.bind(null, userId)} className="flex gap-1.5 items-center">
          <input
            name="password"
            type="text"
            minLength={8}
            placeholder="new password"
            className="text-xs px-2 py-1 rounded border border-slate-300 w-40"
          />
          <button className="text-xs font-medium px-2.5 py-1 rounded bg-navy-900 hover:bg-navy-800 text-white">
            Set
          </button>
        </form>
      )}
    </div>
  );
}
