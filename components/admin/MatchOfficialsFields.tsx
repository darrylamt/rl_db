import { Field } from "@/components/admin/FormShell";
import { SearchableSelect } from "@/components/admin/SearchableSelect";

/**
 * Who is on the game.
 *
 * The same three fields on the new-fixture form and the edit form, so a match
 * from 2019 can have its officials filled in today and corrected tomorrow —
 * recording who refereed is not something that only applies going forward.
 *
 * Leaving a field blank removes that official from the match, which is how
 * a mistake gets undone.
 */

export type OfficialOption = { official_id: string; first_name: string; last_name: string; role: string | null };

export const OFFICIAL_ROLES = [
  { key: "referee", label: "Referee" },
  { key: "touch_judge_1", label: "Touch judge 1" },
  { key: "touch_judge_2", label: "Touch judge 2" },
] as const;

export function MatchOfficialsFields({
  officials,
  current = {},
}: {
  officials: OfficialOption[];
  /** role -> official_id, for a fixture that already has some. */
  current?: Record<string, string>;
}) {
  const options = officials.map((o) => ({
    value: o.official_id,
    label: `${o.first_name} ${o.last_name}`.trim(),
    hint: o.role ?? undefined,
  }));

  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">
        Match officials
      </p>
      {options.length === 0 ? (
        <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded px-3 py-2.5">
          No officials on record yet. Add them under Officials first, and they
          become available here.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Says the form carried these fields at all, so a save from a page
              that rendered none does not read as "take everyone off". */}
          <input type="hidden" name="officials_present" value="1" />
          {OFFICIAL_ROLES.map((r) => (
            <Field key={r.key} label={r.label}>
              <SearchableSelect
                name={r.key}
                emptyLabel="— none —"
                defaultValue={current[r.key] ?? ""}
                options={options}
              />
            </Field>
          ))}
        </div>
      )}
      <p className="text-[11px] text-slate-400 mt-1.5">
        Can be filled in for any match, however old. Clearing a field takes
        that official off the game.
      </p>
    </div>
  );
}
