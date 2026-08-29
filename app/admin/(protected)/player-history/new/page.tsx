import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select, Textarea } from "@/components/admin/FormShell";
import { SearchableSelect } from "@/components/admin/SearchableSelect";
import { createPlayerHistory } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewPlayerHistoryPage() {
  const supabase = createAdminClient();
  let players: any[] = [];
  let teams: any[] = [];
  try {
    const [p, t] = await Promise.all([
      supabase.from("players").select("player_id, first_name, last_name, team:team_id(name)").order("last_name"),
      supabase.from("teams").select("team_id, name").order("name"),
    ]);
    players = p.data ?? [];
    teams = t.data ?? [];
  } catch {
    // form still renders with empty dropdowns
  }

  return (
    <FormShell
      title="Add Club History"
      backHref="/admin/player-history"
      onSubmit={createPlayerHistory}
      submitLabel="Record spell"
    >
      <Field label="Player">
        <SearchableSelect
          name="player_id"
          required
          emptyLabel="— select player —"
          defaultValue={""}
          options={players.map((p: any) => ({
            value: p.player_id,
            label: `${p.first_name} ${p.last_name}`.trim(),
            hint: p.team?.name ?? undefined,
          }))}
        />
      </Field>
      <Field label="Club">
        <SearchableSelect
          name="team_id"
          defaultValue={""}
          options={teams.map((t: any) => ({ value: t.team_id, label: t.name }))}
        />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Season">
          <Input name="season" placeholder="2025" />
        </Field>
        <Field label="Role">
          <Input name="role" placeholder="Player, captain, on loan…" />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Joined">
          <Input name="joined_date" type="date" />
        </Field>
        <Field label="Left">
          <Input name="left_date" type="date" />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea name="notes" />
      </Field>
    </FormShell>
  );
}
