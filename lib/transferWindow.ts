import { createAdminClient } from "@/lib/supabase/server";

export type WindowRow = {
  window_id: string;
  name: string;
  opens_on: string;
  closes_on: string;
  season: string | null;
};

export type TransferWindowState = {
  open: boolean;
  /** 'follow' means the dates decide; the others override them. */
  mode: "follow" | "open" | "closed";
  /** The window covering today, when one does. */
  current: WindowRow | null;
  /** The next one due to open, when the market is shut. */
  next: WindowRow | null;
  windows: WindowRow[];
  /** Said to clubs, so a shut market explains itself. */
  reason: string;
  /**
   * True when the tables are not there yet. Everything stays open, which is
   * how the market behaved before this existed — a migration that has not
   * been run should not lock clubs out.
   */
  notConfigured: boolean;
};

const today = () => new Date().toISOString().slice(0, 10);

function describe(w: WindowRow) {
  return `${w.name} (${w.opens_on} to ${w.closes_on})`;
}

/**
 * Whether clubs may approach each other right now, and why.
 *
 * The switch beats the dates when it is set to either extreme; on 'follow'
 * any window covering today opens the market. Read in one place so the club
 * portal, the server actions and the admin all agree — a market that looks
 * open and refuses the request is worse than one that is plainly shut.
 */
export async function getTransferWindow(): Promise<TransferWindowState> {
  const supabase = createAdminClient();

  const [{ data: settings, error: sErr }, { data: windows, error: wErr }] =
    await Promise.all([
      supabase.from("transfer_settings").select("mode").maybeSingle(),
      supabase
        .from("transfer_windows")
        .select("window_id, name, opens_on, closes_on, season")
        .order("opens_on", { ascending: true }),
    ]);

  if (sErr || wErr) {
    return {
      open: true,
      mode: "follow",
      current: null,
      next: null,
      windows: [],
      reason: "",
      notConfigured: true,
    };
  }

  const mode = ((settings as any)?.mode ?? "follow") as TransferWindowState["mode"];
  const all = (windows ?? []) as WindowRow[];
  const day = today();

  const current = all.find((w) => w.opens_on <= day && day <= w.closes_on) ?? null;
  const next = all.find((w) => w.opens_on > day) ?? null;

  if (mode === "open") {
    return {
      open: true,
      mode,
      current,
      next,
      windows: all,
      reason: "The federation has opened the market.",
      notConfigured: false,
    };
  }

  if (mode === "closed") {
    return {
      open: false,
      mode,
      current,
      next,
      windows: all,
      reason: "The federation has closed the market.",
      notConfigured: false,
    };
  }

  if (current) {
    return {
      open: true,
      mode,
      current,
      next,
      windows: all,
      reason: `Open until ${current.closes_on} — ${current.name}.`,
      notConfigured: false,
    };
  }

  return {
    open: false,
    mode,
    current: null,
    next,
    windows: all,
    reason: next
      ? `The market is shut. It opens on ${next.opens_on} — ${describe(next)}.`
      : "The market is shut, and no window has been set.",
    notConfigured: false,
  };
}
