import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select, Checkbox } from "@/components/admin/FormShell";
import { SearchableSelect } from "@/components/admin/SearchableSelect";
import { PhotoUpload } from "@/components/admin/PhotoUpload";
import { updateTeam } from "../actions";

export default async function EditTeamPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const [{ data: team }, { data: venues }] = await Promise.all([
    supabase.from("teams").select("*").eq("team_id", params.id).maybeSingle(),
    supabase.from("venues").select("venue_id, name").order("name"),
  ]);

  if (!team) notFound();
  const bound = updateTeam.bind(null, params.id);

  return (
    <FormShell title={`Edit: ${team.name}`} backHref="/admin/teams" onSubmit={bound} submitLabel="Save changes">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Name">
          <Input name="name" required defaultValue={team.name} />
        </Field>
        <Field label="Type">
          <Select name="team_type" defaultValue={team.team_type ?? "club"}>
            <option value="club">Club</option>
            <option value="national">National</option>
            <option value="president_xv">President XIII</option>
          </Select>
        </Field>
        <Field label="Division" hint="Drives the men/women/youth toggle on the website">
          <Select name="division" defaultValue={team.division ?? "men"}>
            <option value="men">Men</option>
            <option value="women">Women</option>
            <option value="youth">Youth</option>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Region">
          <Input name="region" defaultValue={team.region ?? ""} />
        </Field>
        <Field label="City">
          <Input name="city" defaultValue={team.city ?? ""} />
        </Field>
      </div>
      <Field label="Home venue">
        <SearchableSelect
          name="home_venue_id"
          emptyLabel="— select —"
          defaultValue={team.home_venue_id ?? ""}
          options={(venues ?? []).map((v: any) => ({ value: v.venue_id, label: v.name }))}
        />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Manager">
          <Input name="manager_name" defaultValue={team.manager_name ?? ""} />
        </Field>
        <Field label="Coach">
          <Input name="coach_name" defaultValue={team.coach_name ?? ""} />
        </Field>
      </div>
      <Field label="Founded year">
        <Input name="founded_year" type="number" min={1800} max={2100} defaultValue={team.founded_year ?? ""} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="URL slug" hint="Public address on the website: /clubs/<slug>">
          <Input name="slug" placeholder="panthers" defaultValue={team.slug ?? ""} />
        </Field>
        <Field label="Legal name" hint="Registered name, if different from the playing name">
          <Input name="legal_name" defaultValue={team.legal_name ?? ""} />
        </Field>
      </div>
      <Field label="Instagram">
        <Input name="instagram_url" type="url" placeholder="https://instagram.com/…" defaultValue={team.instagram_url ?? ""} />
      </Field>
      <Checkbox name="is_public" defaultChecked={team.is_public !== false}  label="Show this club on the public website" />
      <Field label="Club Logo">
        <PhotoUpload name="logo" currentUrl={team.logo_url} label="Logo" shape="square" />
      </Field>
      <Field
        label="Club colour"
        hint="Used for the club's bar in the match poll. Left empty, it is worked out from the crest — set it here when that guess is wrong."
      >
        <div className="flex items-center gap-2">
          <Input
            name="brand_color"
            defaultValue={team.brand_color ?? ""}
            placeholder="#dc2626"
            className="flex-1"
          />
          {team.brand_color && (
            <span
              aria-hidden
              className="w-9 h-9 rounded border border-slate-300 shrink-0"
              style={{ background: team.brand_color }}
            />
          )}
        </div>
      </Field>
    </FormShell>
  );
}
