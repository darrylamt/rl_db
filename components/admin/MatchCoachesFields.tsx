import { Field } from "@/components/admin/FormShell";
import { SearchableSelect } from "@/components/admin/SearchableSelect";

/**
 * Who was in charge of each side.
 *
 * Clubs name their own coach when they build a team sheet, but that only ever
 * reaches matches still to come: an approved sheet is locked to the club, and
 * every past match is approved. Two thirds of past sides have no sheet at all.
 *
 * So the federation can set it here, on the same screen as the officials,
 * for any match however old. Setting a coach on a match with no team sheet
 * creates the sheet as a draft — it does not approve anything and does not
 * take a future match away from the club that still has to name a side.
 */

export type CoachOption = {
  coach_id: string;
  first_name: string;
  last_name: string;
  role: string | null;
  team_id: string | null;
};

export function MatchCoachesFields({
  coaches,
  sides,
  current = {},
}: {
  coaches: CoachOption[];
  /** The two clubs, in the order they should read. */
  sides: { key: "home" | "away"; teamId: string | null; name: string }[];
  /** "<side>_<slot>" -> coach_id, e.g. home_head_coach_id. */
  current?: Record<string, string>;
}) {
  if (coaches.length === 0) {
    return (
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">
          Coaches
        </p>
        <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded px-3 py-2.5">
          No coaches on the register yet. Add them under Coaches first, and
          they become available here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">
        Coaches
      </p>
      {/* Says the form carried these fields at all. Without it, a save from
          a page that rendered no pickers would read as "clear both coaches". */}
      <input type="hidden" name="coaches_present" value="1" />
      <div className="grid gap-4 sm:grid-cols-2">
        {sides.map((side) => {
          // A coach tied to a club can only be named by that club; one left
          // open belongs to nobody and can be named by either.
          const options = coaches
            .filter((c) => !c.team_id || c.team_id === side.teamId)
            .map((c) => ({
              value: c.coach_id,
              label: `${c.first_name} ${c.last_name}`.trim(),
              hint: c.role ?? undefined,
            }));

          return (
            <div
              key={side.key}
              className="border border-slate-200 rounded-lg p-3"
            >
              <p className="text-sm font-medium text-navy-900 mb-2">
                {side.name || (side.key === "home" ? "Home" : "Away")}
              </p>
              {options.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No coaches registered to this club.
                </p>
              ) : (
                <div className="grid gap-3">
                  <Field label="Head coach">
                    <SearchableSelect
                      name={`${side.key}_head_coach_id`}
                      emptyLabel="— none —"
                      defaultValue={current[`${side.key}_head_coach_id`] ?? ""}
                      options={options}
                    />
                  </Field>
                  <Field label="Assistant">
                    <SearchableSelect
                      name={`${side.key}_assistant_coach_id`}
                      emptyLabel="— none —"
                      defaultValue={
                        current[`${side.key}_assistant_coach_id`] ?? ""
                      }
                      options={options}
                    />
                  </Field>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-400 mt-1.5">
        Can be set for any match, however old. This records who was in charge
        and does not approve or change a team sheet.
      </p>
    </div>
  );
}
