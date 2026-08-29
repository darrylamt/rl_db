import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select, Textarea } from "@/components/admin/FormShell";
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
        <Select name="player_id" required defaultValue="">
          <option value="">— select player —</option>
          {players.map((p: any) => (
            <option key={p.player_id} value={p.player_id}>
              {p.first_name} {p.last_name}{p.team?.name ? ` · ${p.team.name}` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Club">
        <Select name="team_id" defaultValue="">
          <option value="">—</option>
          {teams.map((t: any) => (
            <option key={t.team_id} value={t.team_id}>{t.name}</option>
          ))}
        </Select>
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
