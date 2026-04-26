"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bulkCreatePlayers, type BulkPlayerRow } from "../actions";

const EXPECTED_COLUMNS = [
  "first_name", "last_name", "team_name", "jersey_number",
  "position", "gender", "category", "playing_status",
  "date_of_birth", "nationality", "phone", "email", "photo_url",
];

function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter(line => line.trim())
    .map(line => {
      const cols: string[] = [];
      let cur = "";
      let inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; }
        else { cur += ch; }
      }
      cols.push(cur.trim());
      return cols;
    });
}

export default function BulkPlayersPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [teamMap, setTeamMap] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ inserted: number; errors: string[] } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string;
        const parsed = parseCsv(text);
        if (parsed.length < 2) { setParseError("CSV has no data rows."); return; }
        setHeaders(parsed[0].map(h => h.toLowerCase().replace(/\s+/g, "_")));
        setRows(parsed.slice(1));
      } catch {
        setParseError("Failed to parse CSV.");
      }
    };
    reader.readAsText(file);
  }

  function colIdx(name: string) {
    return headers.indexOf(name);
  }
  function cell(row: string[], name: string) {
    const i = colIdx(name);
    return i >= 0 ? row[i] ?? "" : "";
  }

  async function handleSubmit() {
    setPending(true);
    setResult(null);
    try {
      const bulkRows: BulkPlayerRow[] = rows.map(row => {
        const teamName = cell(row, "team_name").trim();
        const jn = cell(row, "jersey_number").trim();
        return {
          first_name: cell(row, "first_name").trim(),
          last_name: cell(row, "last_name").trim(),
          team_id: teamName ? (teamMap[teamName.toLowerCase()] ?? null) : null,
          jersey_number: jn ? parseInt(jn, 10) || null : null,
          position: cell(row, "position").trim() || null,
          gender: cell(row, "gender").trim() || "male",
          category: cell(row, "category").trim() || "senior_men",
          playing_status: cell(row, "playing_status").trim() || "inactive",
          date_of_birth: cell(row, "date_of_birth").trim() || null,
          nationality: cell(row, "nationality").trim() || null,
          phone: cell(row, "phone").trim() || null,
          email: cell(row, "email").trim() || null,
          photo_url: cell(row, "photo_url").trim() || null,
        };
      });
      const res = await bulkCreatePlayers(bulkRows);
      setResult(res);
      if (res.inserted > 0 && res.errors.length === 0) {
        setTimeout(() => router.push("/admin/players"), 1500);
      }
    } catch (err: any) {
      setResult({ inserted: 0, errors: [err?.message ?? "Unknown error"] });
    } finally {
      setPending(false);
    }
  }

  const hasData = rows.length > 0;
  const fnIdx = colIdx("first_name");
  const lnIdx = colIdx("last_name");
  const missingRequired = hasData && (fnIdx < 0 || lnIdx < 0);

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <nav className="mb-6">
        <Link
          href="/admin/players"
          className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:border-navy-300 hover:bg-slate-50 text-slate-700 hover:text-navy-900 text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm transition-colors"
        >
          ← Back to Players
        </Link>
      </nav>

      <h1 className="font-display text-2xl md:text-3xl font-bold text-navy-900 mb-2">
        Bulk Upload Players
      </h1>
      <p className="text-sm text-slate-600 mb-6">
        Upload a CSV file. The <code className="bg-slate-100 px-1 rounded">photo_url</code> column should contain a direct image link (URL). Required columns: <code className="bg-slate-100 px-1 rounded">first_name</code>, <code className="bg-slate-100 px-1 rounded">last_name</code>.
      </p>

      {/* Column reference */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Supported CSV columns</p>
        <div className="flex flex-wrap gap-1.5">
          {EXPECTED_COLUMNS.map(c => (
            <span key={c} className={`text-xs px-2 py-0.5 rounded font-mono ${c === "first_name" || c === "last_name" ? "bg-navy-900 text-white" : "bg-slate-200 text-slate-700"}`}>
              {c}
            </span>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          For <code className="bg-slate-100 px-1 rounded">team_name</code>, use the exact team name as it appears in the database. The <code className="bg-slate-100 px-1 rounded">photo_url</code> column accepts a direct image URL (no file upload needed).
        </p>
      </div>

      {/* File input */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 md:p-6 mb-6">
        <label className="block text-xs uppercase tracking-wider text-slate-600 mb-2">CSV File</label>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="block text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-navy-900 file:text-white hover:file:bg-navy-800 cursor-pointer"
        />
        {parseError && (
          <p className="text-red-700 text-sm mt-2">{parseError}</p>
        )}
      </div>

      {/* Preview */}
      {hasData && (
        <>
          {missingRequired && (
            <div className="bg-amber-50 border border-amber-300 text-amber-800 text-sm px-3 py-2 rounded mb-4">
              Missing required columns: <strong>first_name</strong> and/or <strong>last_name</strong>. Check your CSV headers.
            </div>
          )}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-medium text-navy-900">{rows.length} row{rows.length !== 1 ? "s" : ""} detected</span>
              <span className="text-xs text-slate-500">Showing first 5</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    {headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-2 text-slate-700 max-w-[160px] truncate">
                          {colIdx("photo_url") === j && cell ? (
                            <a href={cell} target="_blank" rel="noreferrer" className="text-navy-700 hover:underline truncate block max-w-[120px]">
                              {cell.split("/").pop()?.slice(0, 20) ?? "link"}
                            </a>
                          ) : cell || <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className={`mb-4 px-4 py-3 rounded border text-sm ${result.errors.length === 0 ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-amber-50 border-amber-300 text-amber-800"}`}>
              <p className="font-semibold">{result.inserted} player{result.inserted !== 1 ? "s" : ""} imported.</p>
              {result.errors.length > 0 && (
                <ul className="mt-1 space-y-0.5 list-disc list-inside">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={pending || missingRequired}
            className="bg-navy-900 hover:bg-navy-800 disabled:opacity-60 text-white px-6 py-2.5 rounded font-medium text-sm"
          >
            {pending ? "Importing…" : `Import ${rows.length} player${rows.length !== 1 ? "s" : ""}`}
          </button>
        </>
      )}
    </div>
  );
}
