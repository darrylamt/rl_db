import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { SearchableSelect } from "@/components/admin/SearchableSelect";
import { FormShell, Field, Input, Select } from "@/components/admin/FormShell";
import { UploadOrLink } from "@/components/admin/UploadOrLink";
import { updatePartner } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditPartnerPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const [{ data: p }, { data: clubs }] = await Promise.all([
    supabase.from("partners").select("*").eq("partner_id", params.id).maybeSingle(),
    supabase.from("teams").select("team_id, name").eq("team_type", "club").order("name"),
  ]);
  if (!p) notFound();

  const bound = updatePartner.bind(null, params.id);

  return (
    <FormShell title={`Edit: ${p.name}`} backHref="/admin/partners" onSubmit={bound} submitLabel="Save changes">
      <Field label="Name">
        <Input name="name" required defaultValue={p.name} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Tier">
          <Select name="tier" defaultValue={String(p.tier ?? 1)}>
            <option value="1">Tier 1</option>
            <option value="2">Tier 2</option>
            <option value="3">Tier 3</option>
          </Select>
        </Field>
        <Field label="Tier heading" hint="Editable copy, e.g. Official Partners">
          <Input name="tier_title" defaultValue={p.tier_title ?? ""} />
        </Field>
      </div>
      <Field
        label="Whose partner"
        hint="Federation partners show across the site; a club's show on that club's profile."
      >
        <SearchableSelect
          name="team_id"
          emptyLabel="— the federation —"
          defaultValue={p.team_id ?? ""}
          options={(clubs ?? []).map((t: any) => ({ value: t.team_id, label: t.name }))}
        />
      </Field>
      <Field label="Designation" hint="Optional line under the logo">
        <Input name="designation" defaultValue={p.designation ?? ""} />
      </Field>
      <Field label="Website">
        <Input name="link" type="url" defaultValue={p.link ?? ""} />
      </Field>
      <Field label="Logo" hint="Shown on the partners page and in the site footer.">
        <UploadOrLink
          urlName="logo_url"
          bucket="content-images"
          prefix="partners"
          accept="image/*"
          urlPlaceholder="/partners/polytank.png"
          currentUrl={p.logo_url}
        />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Sort order" hint="Lower shows first">
          <Input name="sort_order" type="number" defaultValue={p.sort_order ?? 0} />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={p.status ?? "active"}>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </Select>
        </Field>
      </div>
    </FormShell>
  );
}
