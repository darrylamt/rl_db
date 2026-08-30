import { FormShell, Field, Input, Select } from "@/components/admin/FormShell";
import { UploadOrLink } from "@/components/admin/UploadOrLink";
import { SearchableSelect } from "@/components/admin/SearchableSelect";
import { createAdminClient } from "@/lib/supabase/server";
import { createPartner } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewPartnerPage() {
  const supabase = createAdminClient();
  const { data: clubs } = await supabase
    .from("teams")
    .select("team_id, name")
    .eq("team_type", "club")
        // Retired clubs are not somewhere new things can be filed.
        .neq("is_public", false)
    .order("name");

  return (
    <FormShell title="Add Partner" backHref="/admin/partners" onSubmit={createPartner} submitLabel="Add partner">
      <Field label="Name">
        <Input name="name" required placeholder="Polytank Ghana Limited" />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Tier">
          <Select name="tier" defaultValue="1">
            <option value="1">Tier 1</option>
            <option value="2">Tier 2</option>
            <option value="3">Tier 3</option>
          </Select>
        </Field>
        <Field label="Tier heading" hint="Editable copy, e.g. Official Partners">
          <Input name="tier_title" placeholder="Official Partners" />
        </Field>
      </div>
      <Field
        label="Whose partner"
        hint="Federation partners show across the site; a club's show on that club's profile."
      >
        <SearchableSelect
          name="team_id"
          emptyLabel="— the federation —"
          defaultValue={""}
          options={(clubs ?? []).map((t: any) => ({ value: t.team_id, label: t.name }))}
        />
      </Field>
      <Field label="Designation" hint="Optional line under the logo">
        <Input name="designation" />
      </Field>
      <Field label="Website">
        <Input name="link" type="url" />
      </Field>
      <Field label="Logo" hint="Shown on the partners page and in the site footer.">
        <UploadOrLink
          urlName="logo_url"
          bucket="content-images"
          prefix="partners"
          accept="image/*"
          urlPlaceholder="/partners/polytank.png"
          
        />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Sort order" hint="Lower shows first">
          <Input name="sort_order" type="number" defaultValue={0} />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue="active">
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </Select>
        </Field>
      </div>
    </FormShell>
  );
}
