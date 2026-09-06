import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import {
  changesIn,
  headline,
  resolveNames,
  subjectHref,
  thingName,
  whoDidIt,
  type AuditEntry,
} from "@/lib/auditPlain";

export const dynamic = "force-dynamic";

const SELECT =
  "entry_id, at, actor_email, actor_role, action, entity, entity_id, summary, detail";

/** What the verb at the end of the action actually did. */
function whatHappened(action: string): { word: string; tone: string } {
  if (action.endsWith(".insert"))
    return { word: "Something was added", tone: "bg-emerald-100 text-emerald-800" };
  if (action.endsWith(".delete"))
    return { word: "Something was removed", tone: "bg-red-100 text-red-800" };
  if (action.endsWith(".update"))
    return { word: "Something was changed", tone: "bg-sky-100 text-sky-800" };
  return { word: "An action was taken", tone: "bg-slate-100 text-slate-700" };
}

export default async function AuditEntryPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("audit_log")
    .select(SELECT)
    .eq("entry_id", params.id)
    .maybeSingle();

  if (!data) notFound();
  const entry = data as AuditEntry;

  const names = await resolveNames([entry]);
  const changes = changesIn(entry.detail, names);
  const what = whatHappened(entry.action);
  const subject = entry.entity_id ? names.get(entry.entity_id) : null;
  const href = subjectHref(entry);

  const when = new Date(entry.at).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // An insert or a delete carries the whole row rather than a change list.
  const wholeRow = entry.detail?.new ?? entry.detail?.old ?? null;

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <Link
        href="/admin/audit"
        className="text-sm text-slate-500 hover:underline"
      >
        ← Back to the trail
      </Link>

      <header className="mt-3 mb-6">
        <span
          className={`inline-block text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${what.tone}`}
        >
          {what.word}
        </span>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-navy-900 mt-2">
          {headline(entry, names)}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {when} &middot; by {whoDidIt(entry)}
        </p>
      </header>

      {/* In one sentence, for somebody who has never seen this screen. */}
      <section className="bg-navy-900 text-white rounded-lg p-4 mb-6">
        <p className="text-xs uppercase tracking-wider text-white/60 mb-1">
          In plain English
        </p>
        <p className="text-sm leading-relaxed">
          On {when}, {whoDidIt(entry)}{" "}
          {entry.action.endsWith(".insert")
            ? "created"
            : entry.action.endsWith(".delete")
              ? "deleted"
              : entry.action.endsWith(".update")
                ? "edited"
                : "acted on"}{" "}
          {subject ? (
            <>
              the {thingName(entry.entity)} <strong>{subject}</strong>
            </>
          ) : (
            <>a {thingName(entry.entity)}</>
          )}
          {changes.length > 0 && (
            <>
              , changing {changes.length}{" "}
              {changes.length === 1 ? "thing" : "things"}
            </>
          )}
          .{" "}
          {entry.actor_role === "system" && (
            <span className="text-white/70">
              No one was signed in, so this came from the site&rsquo;s own
              server code, a migration, or the SQL editor rather than from a
              person clicking in the admin.
            </span>
          )}
        </p>
      </section>

      {changes.length > 0 && (
        <section className="mb-6">
          <h2 className="font-display text-lg text-navy-900 mb-2">
            What changed
          </h2>
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr className="text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-2.5 font-medium">Field</th>
                    <th className="px-4 py-2.5 font-medium">Was</th>
                    <th className="px-4 py-2.5 font-medium">Became</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {changes.map((c) => (
                    <tr key={c.field}>
                      <td className="px-4 py-2.5 font-medium text-navy-900">
                        {c.label}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 line-through decoration-slate-300">
                        {c.before}
                      </td>
                      <td className="px-4 py-2.5 text-navy-900">{c.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="mb-6">
        <h2 className="font-display text-lg text-navy-900 mb-2">
          What it was about
        </h2>
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 text-sm">
          {[
            ["Record", subject ?? "no longer on record"],
            ["Kind of record", thingName(entry.entity)],
            ["Done by", whoDidIt(entry)],
            ["Their role", entry.actor_role ?? "unknown"],
            ["Recorded at", when],
            ["Internal action name", entry.action],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between gap-4 px-4 py-2.5">
              <span className="text-slate-500 shrink-0">{label}</span>
              <span className="text-navy-900 text-right break-words">
                {String(value)}
              </span>
            </div>
          ))}
        </div>
        {href && (
          <Link
            href={href}
            className="inline-block mt-3 text-sm text-navy-800 hover:underline"
          >
            Open this {thingName(entry.entity)} &rarr;
          </Link>
        )}
        {!subject && entry.entity_id && (
          <p className="text-xs text-slate-400 mt-2">
            The record this refers to has since been deleted, so there is
            nothing left to open. The entry stays either way &mdash; that is
            what a trail is for.
          </p>
        )}
      </section>

      {wholeRow && (
        <section className="mb-6">
          <h2 className="font-display text-lg text-navy-900 mb-2">
            {entry.action.endsWith(".delete")
              ? "What it looked like before it went"
              : "What was created"}
          </h2>
          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 text-sm">
            {Object.entries(wholeRow)
              .filter(([, v]) => v !== null && v !== "" )
              .slice(0, 25)
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-2">
                  <span className="text-slate-500 shrink-0">
                    {k.replace(/_/g, " ")}
                  </span>
                  <span className="text-navy-900 text-right break-all">
                    {typeof v === "object" ? JSON.stringify(v) : String(v)}
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* The raw entry, for when the words are not enough. */}
      <details className="group">
        <summary className="cursor-pointer text-sm text-slate-500 hover:text-navy-800">
          Show the raw record
        </summary>
        <pre className="mt-2 bg-slate-900 text-slate-100 text-xs rounded-lg p-4 overflow-x-auto">
          {JSON.stringify(entry, null, 2)}
        </pre>
      </details>
    </div>
  );
}
