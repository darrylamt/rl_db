"use client";

import { useState } from "react";

/**
 * One team's line-up at a time, with the other a tap away.
 *
 * Two squads side by side is thirty-odd names on a phone screen. The home
 * side leads because that is how the fixture is written and how the
 * scoreboard above reads.
 */
export function TeamSwitch({
  homeName,
  awayName,
  homeLogo,
  awayLogo,
  home,
  away,
}: {
  homeName: string;
  awayName: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  home: React.ReactNode;
  away: React.ReactNode;
}) {
  const [side, setSide] = useState<"home" | "away">("home");

  const Pill = ({
    which,
    name,
    logo,
  }: {
    which: "home" | "away";
    name: string;
    logo?: string | null;
  }) => {
    const on = side === which;
    return (
      <button
        onClick={() => setSide(which)}
        aria-pressed={on}
        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm transition ${
          on
            ? "bg-white/10 text-white font-medium"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="w-5 h-5 object-contain shrink-0" />
        ) : null}
        <span className="truncate">{name}</span>
      </button>
    );
  };

  return (
    <div>
      <div className="flex gap-1 bg-neutral-900 border border-white/10 rounded-lg p-1 mb-3">
        <Pill which="home" name={homeName} logo={homeLogo} />
        <Pill which="away" name={awayName} logo={awayLogo} />
      </div>
      <div hidden={side !== "home"}>{home}</div>
      <div hidden={side !== "away"}>{away}</div>
    </div>
  );
}
