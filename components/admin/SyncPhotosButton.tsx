"use client";

import { useState } from "react";

interface SyncResult {
  updated: number;
  skipped: number;
  failed: number;
  unmatched: number;
  details: {
    updated: string[];
    skipped: string[];
    failed: string[];
    unmatched: string[];
  };
}

export function SyncPhotosButton() {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<SyncResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  async function handleSync() {
    if (!confirm(
      "This will download all player photos from the Airtable registration base and store them permanently in Supabase Storage.\n\nPlayers that already have a non-Airtable photo will be skipped.\n\nContinue?"
    )) return;

    setState("running");
    setResult(null);
    setErrorMsg("");

    try {
      const res = await fetch("/api/admin/sync-photos", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Sync failed");
      setResult(json.data);
      setState("done");
    } catch (e: any) {
      setErrorMsg(e.message ?? "Sync failed");
      setState("error");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleSync}
        disabled={state === "running"}
        className="border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 py-2.5 rounded font-medium text-sm whitespace-nowrap flex items-center gap-1.5 disabled:opacity-50 transition-colors"
        title="Import player photos from Airtable registration"
      >
        {state === "running" ? (
          <>
            <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            Syncing photos…
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Zm10 5.414-1.293-1.293a1 1 0 0 0-1.414 0L7 10.414l-1.293-1.293a1 1 0 0 0-1.414 0L3 10.414V12h9v-2.586ZM6.5 7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
            </svg>
            Sync Photos
          </>
        )}
      </button>

      {/* Result modal */}
      {(state === "done" || state === "error") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            {state === "error" ? (
              <>
                <h2 className="font-display text-lg font-bold text-red-700">Sync failed</h2>
                <p className="text-sm text-red-600 bg-red-50 rounded p-3">{errorMsg}</p>
              </>
            ) : result && (
              <>
                <h2 className="font-display text-lg font-bold text-navy-900">Photo sync complete</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-display font-bold text-emerald-700">{result.updated}</div>
                    <div className="text-xs text-emerald-600 mt-0.5">Updated</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-display font-bold text-slate-600">{result.skipped}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Already had photo</div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-display font-bold text-amber-700">{result.unmatched}</div>
                    <div className="text-xs text-amber-600 mt-0.5">No rl-db match</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-display font-bold text-red-700">{result.failed}</div>
                    <div className="text-xs text-red-600 mt-0.5">Errors</div>
                  </div>
                </div>

                {result.unmatched > 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded p-2">
                    ⚠ {result.unmatched} Airtable players had no matching name in rl-db. Their photos were not imported. Check spelling matches between systems.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setShowDetails((v) => !v)}
                  className="text-xs text-navy-700 hover:underline"
                >
                  {showDetails ? "Hide" : "Show"} details
                </button>

                {showDetails && (
                  <div className="max-h-64 overflow-y-auto text-xs space-y-3 border rounded p-3 bg-slate-50">
                    {result.details.updated.length > 0 && (
                      <div>
                        <p className="font-semibold text-emerald-700 mb-1">Updated ({result.details.updated.length})</p>
                        {result.details.updated.map((n, i) => <p key={i} className="text-slate-600">✓ {n}</p>)}
                      </div>
                    )}
                    {result.details.failed.length > 0 && (
                      <div>
                        <p className="font-semibold text-red-700 mb-1">Failed ({result.details.failed.length})</p>
                        {result.details.failed.map((n, i) => <p key={i} className="text-red-600">✗ {n}</p>)}
                      </div>
                    )}
                    {result.details.unmatched.length > 0 && (
                      <div>
                        <p className="font-semibold text-amber-700 mb-1">Unmatched in Airtable ({result.details.unmatched.length})</p>
                        {result.details.unmatched.map((n, i) => <p key={i} className="text-slate-500">? {n}</p>)}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => { setState("idle"); setResult(null); }}
              className="w-full py-2 rounded bg-navy-900 text-white text-sm font-medium hover:bg-navy-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
