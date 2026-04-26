import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select, Textarea } from "@/components/admin/FormShell";
import { createSuspension } from "../actions";

export const dynamic = "force-dynamic";

const STATUSES = ["active","served","overturned"];

export default async function NewSuspensionPage() {
  const supabase = createAdminClient();
  let players: any[] = [];
  let fixtures: any[] = [];
  try {
    const [p, f] = await Promise.all([
      supabase.from("players").select("player_id, first_name, last_name, team:team_id(name)").order("last_name"),
      supabase.from("fixtures").select("fixture_id, scheduled_date, home:home_team_id(name), away:away_team_id(name)").order("scheduled_date", { ascending: false }).limit(50),
    ]);
    players = p.data ?? [];
    fixtures = f.data ?? [];
  } catch {
    // form still renders with empty dropdowns
  }

  return (
    <FormShell title="Add Suspension" backHref="/admin/suspensions" onSubmit={createSuspension} submitLabel="Record suspension">
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
      <Field label="Related fixture (optional)">
        <Select name="fixture_id" defaultValue="">
          <option value="">—</option>
          {fixtures.map((f: any) => (
            <option key={f.fixture_id} value={f.fixture_id}>
              {f.scheduled_date} · {f.home?.name ?? "?"} vs {f.away?.name ?? "?"}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Reason">
        <Input name="reason" placeholder="Red card — dangerous tackle" />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Matches banned">
          <Input name="matches_banned" type="number" min={0} />
        </Field>
        <Field label="Start date">
          <Input name="start_date" type="date" />
        </Field>
        <Field label="End date">
          <Input name="end_date" type="date" />
        </Field>
      </div>
      <Field label="Status">
        <Select name="status" defaultValue="active">
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
      </Field>
      <Field label="Notes">
        <Textarea name="notes" />
      </Field>
    </FormShell>
  );
}
