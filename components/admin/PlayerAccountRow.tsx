"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";

/**
 * One player and their sign-in address.
 *
 * The address is the thing this page exists to hand over, so it is the
 * easiest thing to take: one tap copies it, and there is no need to select
 * text on a phone.
 */
export function PlayerAccountRow({
  player,
  query,
  resetPassword,
  revoke,
  create,
}: {
  player: any;
  query: string;
  resetPassword: (userId: string, fd: FormData) => Promise<void>;
  revoke: (userId: string) => Promise<void>;
  create: (playerId: string, fd: FormData) => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const account = player.account;

  const copy = async () => {
    if (!account?.email) return;
    try {
      await navigator.clipboard.writeText(account.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — the address is on screen to read either way.
    }
  };

  return (
    <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
      <Avatar src={player.photo_url} name={player.name} size={36} />

      <div className="min-w-0 flex-1">
        <p className="font-medium text-navy-900 truncate">
          {player.name}
          {player.playing_status !== "active" && (
            <span className="ml-2 text-[10px] uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
              {player.playing_status ?? "inactive"}
            </span>
          )}
        </p>
        <p className="text-xs text-slate-500 truncate">
          {[player.team?.name, player.position].filter(Boolean).join(" · ") ||
            "No club"}
        </p>
      </div>

      {account ? (
        <>
          <button
            type="button"
            onClick={copy}
            title="Copy the address"
            className="min-w-0 text-left text-sm font-mono text-navy-800 hover:text-navy-900 hover:underline truncate max-w-[16rem]"
          >
            {copied ? "copied" : account.email}
          </button>

          {account.must_change_password && (
            <span
              className="text-[10px] uppercase tracking-wider bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded shrink-0"
              title="Still on the shared password"
            >
              not set up
            </span>
          )}

          <div className="flex gap-1.5 shrink-0">
            <form action={resetPassword.bind(null, account.user_id)}>
              <input type="hidden" name="q" value={query} />
              <button className="text-xs px-2.5 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-50">
                Reset
              </button>
            </form>
            <form
              action={revoke.bind(null, account.user_id)}
              onSubmit={(e) => {
                if (
                  !confirm(
                    `Remove ${player.name}'s login? They keep their record and their stats — only the sign-in goes.`
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
        </>
      ) : (
        <form action={create.bind(null, player.player_id)} className="shrink-0">
          <input type="hidden" name="q" value={query} />
          <button className="text-xs font-medium px-3 py-1.5 rounded border border-navy-300 text-navy-800 hover:bg-navy-50">
            Give them a login
          </button>
        </form>
      )}
    </div>
  );
}
