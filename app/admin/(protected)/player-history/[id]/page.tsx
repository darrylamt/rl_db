import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select, Textarea } from "@/components/admin/FormShell";
import { updatePlayerHistory } from "../actions";

export default async function EditPlayerHistoryPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const [{ data: h }, { data: players }, { data: teams }] = await Promise.all([
    supabase.from("player_history").select("*").eq("history_id", params.id).maybeSingle(),
    supabase.from("players").select("player_id, first_name, last_name, team:team_id(name)").order("last_name"),
    supabase.from("teams").select("team_id, name").order("name"),
  ]);
  if (!h) notFound();
  const bound = updatePlayerHistory.bind(null, params.id);

  return (
    <FormShell
      title="Edit Club History"
      backHref="/admin/player-history"
      onSubmit={bound}
      submitLabel="Save changes"
    >
      <Field label="Player">
        <Select name="player_id" required defaultValue={h.player_id ?? ""}>
          <option value="">— select player —</option>
          {(players ?? []).map((p: any) => (
            <option key={p.player_id} value={p.player_id}>
              {p.first_name} {p.last_name}{p.team?.name ? ` · ${p.team.name}` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Club">
        <Select name="team_id" defaultValue={h.team_id ?? ""}>
          <option value="">—</option>
          {(teams ?? []).map((t: any) => (
            <option key={t.team_id} value={t.team_id}>{t.name}</option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Season">
          <Input name="season" defaultValue={h.season ?? ""} placeholder="2025" />
        </Field>
        <Field label="Role">
          <Input name="role" defaultValue={h.role ?? ""} placeholder="Player, captain, on loan…" />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Joined">
          <Input name="joined_date" type="date" defaultValue={h.joined_date ?? ""} />
        </Field>
        <Field label="Left">
          <Input name="left_date" type="date" defaultValue={h.left_date ?? ""} />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea name="notes" defaultValue={h.notes ?? ""} />
      </Field>
    </FormShell>
  );
}
