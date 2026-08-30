"use client";

import { useState } from "react";
import type { TransferWindowState } from "@/lib/transferWindow";

/**
 * The market's opening hours.
 *
 * Two controls that answer different questions. The dates are the plan and
 * run without anyone present; the switch is the exception, and says plainly
 * that it is overriding them rather than quietly disagreeing.
 */
export function TransferWindowPanel({
  state,
  setMode,
  addWindow,
  removeWindow,
}: {
  state: TransferWindowState;
  setMode: (mode: string) => Promise<void>;
  addWindow: (fd: FormData) => Promise<void>;
  removeWindow: (windowId: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const overriding = state.mode !== "follow";

  if (state.notConfigured) {
    return (
      <div className="bg-amber-50 border border-amber-300 text-amber-900 text-sm px-3 py-2.5 rounded mb-6">
        Run <code className="font-mono">supabase/transfer_window.sql</code> to
        control when the market is open. Until then it is open all the time.
      </div>
    );
  }

  const Mode = ({ value, label }: { value: string; label: string }) => (
    <form action={setMode.bind(null, value)}>
      <button
        className={`px-3 py-1.5 rounded text-xs font-medium border ${
          state.mode === value
            ? "bg-navy-900 text-white border-navy-900"
            : "bg-white border-slate-300 text-slate-700 hover:border-navy-400"
        }`}
      >
        {label}
      </button>
    </form>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-lg text-navy-900">Transfer market</h2>
          <p className="text-sm mt-0.5">
            <span
              className={`inline-block w-2 h-2 rounded-full mr-1.5 align-middle ${
                state.open ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
            <span className={state.open ? "text-emerald-800" : "text-red-800"}>
              {state.open ? "Open" : "Closed"}
            </span>
            <span className="text-slate-500"> — {state.reason}</span>
          </p>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          <Mode value="follow" label="Use the dates" />
          <Mode value="open" label="Force open" />
          <Mode value="closed" label="Force closed" />
        </div>
      </div>

      {overriding && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mt-3">
          The switch is overriding the dates. Set it back to
          &ldquo;use the dates&rdquo; when the exception is over, or the
          windows below will not take effect.
        </p>
      )}

      {/* The dates */}
      <div className="mt-4 pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-xs uppercase tracking-wider text-slate-500">
            Windows
          </h3>
          <button
            onClick={() => setAdding(!adding)}
            className="text-xs text-navy-700 hover:underline"
          >
            {adding ? "Cancel" : "Add a window"}
          </button>
        </div>

        {adding && (
          <form
            action={addWindow}
            className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] items-end bg-slate-50 border border-slate-200 rounded p-3 mb-3"
          >
            <label className="text-xs text-slate-600">
              <span className="block mb-1">Name</span>
              <input
                name="name"
                required
                placeholder="Pre-season 2027"
                className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              <span className="block mb-1">Opens</span>
              <input name="opens_on" type="date" required className="px-2 py-1.5 rounded border border-slate-300 text-sm" />
            </label>
            <label className="text-xs text-slate-600">
              <span className="block mb-1">Closes</span>
              <input name="closes_on" type="date" required className="px-2 py-1.5 rounded border border-slate-300 text-sm" />
            </label>
            <button className="bg-navy-900 hover:bg-navy-800 text-white text-xs font-medium px-3 py-2 rounded">
              Add
            </button>
          </form>
        )}

        {state.windows.length === 0 ? (
          <p className="text-xs text-slate-500">
            No windows set. With none, the market stays shut unless the switch
            is forcing it open.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {state.windows.map((w) => {
              const now = state.current?.window_id === w.window_id;
              return (
                <li key={w.window_id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-navy-900">{w.name}</span>
                    <span className="block text-xs text-slate-500 tabular-nums">
                      {w.opens_on} → {w.closes_on}
                    </span>
                  </span>
                  {now && (
                    <span className="text-[10px] uppercase tracking-wider bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded shrink-0">
                      Covers today
                    </span>
                  )}
                  <form action={removeWindow.bind(null, w.window_id)}>
                    <button className="text-xs text-red-600 hover:underline shrink-0">
                      Remove
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
