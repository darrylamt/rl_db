import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select, Textarea } from "@/components/admin/FormShell";
import { updateSuspension } from "../actions";

const STATUSES = ["active","served","overturned"];

export default async function EditSuspensionPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const [{ data: s }, { data: players }, { data: fixtures }] = await Promise.all([
    supabase.from("suspensions").select("*").eq("suspension_id", params.id).maybeSingle(),
    supabase.from("players").select("player_id, first_name, last_name, team:team_id(name)").order("last_name"),
    supabase.from("fixtures").select("fixture_id, scheduled_date, home:home_team_id(name), away:away_team_id(name)").order("scheduled_date", { ascending: false }).limit(100),
  ]);
  if (!s) notFound();
  const bound = updateSuspension.bind(null, params.id);

  return (
    <FormShell title="Edit Suspension" backHref="/admin/suspensions" onSubmit={bound} submitLabel="Save changes">
      <Field label="Player">
        <Select name="player_id" required defaultValue={s.player_id ?? ""}>
          <option value="">— select player —</option>
          {(players ?? []).map((p: any) => (
            <option key={p.player_id} value={p.player_id}>
              {p.first_name} {p.last_name}{p.team?.name ? ` · ${p.team.name}` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Related fixture (optional)">
        <Select name="fixture_id" defaultValue={s.fixture_id ?? ""}>
          <option value="">—</option>
          {(fixtures ?? []).map((f: any) => (
            <option key={f.fixture_id} value={f.fixture_id}>
              {f.scheduled_date} · {f.home?.name ?? "?"} vs {f.away?.name ?? "?"}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Reason">
        <Input name="reason" defaultValue={s.reason ?? ""} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Matches banned">
          <Input name="matches_banned" type="number" min={0} defaultValue={s.matches_banned ?? ""} />
        </Field>
        <Field label="Start date">
          <Input name="start_date" type="date" defaultValue={s.start_date ?? ""} />
        </Field>
        <Field label="End date">
          <Input name="end_date" type="date" defaultValue={s.end_date ?? ""} />
        </Field>
      </div>
      <Field label="Status">
        <Select name="status" defaultValue={s.status ?? "active"}>
          {STATUSES.map(x => <option key={x} value={x}>{x}</option>)}
        </Select>
      </Field>
      <Field label="Notes">
        <Textarea name="notes" defaultValue={s.notes ?? ""} />
      </Field>
    </FormShell>
  );
}
