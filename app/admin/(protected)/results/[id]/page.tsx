import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Textarea } from "@/components/admin/FormShell";
import { upsertResult } from "../actions";

export default async function EditResultPage({ params }: { params: { id: string } }) {
  // params.id is the FIXTURE id (results are keyed by fixture_id unique)
  const supabase = createAdminClient();
  const [{ data: fixture }, { data: result }] = await Promise.all([
    supabase
      .from("fixtures")
      .select("fixture_id, scheduled_date, home:home_team_id(name), away:away_team_id(name), competition:competition_id(name)")
      .eq("fixture_id", params.id)
      .maybeSingle(),
    supabase.from("match_results").select("*").eq("fixture_id", params.id).maybeSingle(),
  ]);
  if (!fixture) notFound();

  const f: any = fixture;
  const r: any = result ?? {};
  const bound = upsertResult.bind(null, params.id);

  return (
    <FormShell
      title={`Result: ${f.home?.name ?? "?"} vs ${f.away?.name ?? "?"}`}
      backHref="/admin/results"
      onSubmit={bound}
      submitLabel={result ? "Update result" : "Record result"}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={`${f.home?.name ?? "Home"} score`}>
          <Input name="home_score" type="number" min={0} defaultValue={r.home_score ?? 0} required />
        </Field>
        <Field label={`${f.away?.name ?? "Away"} score`}>
          <Input name="away_score" type="number" min={0} defaultValue={r.away_score ?? 0} required />
        </Field>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <Field label="Home tries">
          <Input name="home_tries" type="number" min={0} defaultValue={r.home_tries ?? 0} />
        </Field>
        <Field label="Home conv.">
          <Input name="home_conversions" type="number" min={0} defaultValue={r.home_conversions ?? 0} />
        </Field>
        <Field label="Home pens.">
          <Input name="home_penalties" type="number" min={0} defaultValue={r.home_penalties ?? 0} />
        </Field>
        <Field label="Home drop">
          <Input name="home_drop_goals" type="number" min={0} defaultValue={r.home_drop_goals ?? 0} />
        </Field>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <Field label="Away tries">
          <Input name="away_tries" type="number" min={0} defaultValue={r.away_tries ?? 0} />
        </Field>
        <Field label="Away conv.">
          <Input name="away_conversions" type="number" min={0} defaultValue={r.away_conversions ?? 0} />
        </Field>
        <Field label="Away pens.">
          <Input name="away_penalties" type="number" min={0} defaultValue={r.away_penalties ?? 0} />
        </Field>
        <Field label="Away drop">
          <Input name="away_drop_goals" type="number" min={0} defaultValue={r.away_drop_goals ?? 0} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Attendance">
          <Input name="attendance" type="number" min={0} defaultValue={r.attendance ?? ""} />
        </Field>
        <Field label="Recorded by">
          <Input name="recorded_by" defaultValue={r.recorded_by ?? ""} placeholder="Your name" />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea name="notes" defaultValue={r.notes ?? ""} />
      </Field>
    </FormShell>
  );
}
