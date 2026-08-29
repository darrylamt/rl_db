import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select, Textarea } from "@/components/admin/FormShell";
import { SearchableSelect } from "@/components/admin/SearchableSelect";
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
        <SearchableSelect
          name="player_id"
          required
          emptyLabel="— select player —"
          defaultValue={h.player_id ?? ""}
          options={(players ?? []).map((p: any) => ({
            value: p.player_id,
            label: `${p.first_name} ${p.last_name}`.trim(),
            hint: p.team?.name ?? undefined,
          }))}
        />
      </Field>
      <Field label="Club">
        <SearchableSelect
          name="team_id"
          defaultValue={h.team_id ?? ""}
          options={(teams ?? []).map((t: any) => ({ value: t.team_id, label: t.name }))}
        />
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
