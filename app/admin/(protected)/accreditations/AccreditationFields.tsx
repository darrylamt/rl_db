import { Field, Input, Select } from "@/components/admin/FormShell";
import { PhotoUpload } from "@/components/admin/PhotoUpload";
import { STAFF_CATEGORIES } from "@/lib/idCard";

/** Suggestions only: any role can be typed. */
const ROLE_IDEAS = [
  "Team Manager",
  "Assistant Team Manager",
  "Physiotherapist",
  "Medic",
  "Kit Manager",
  "Water Carrier",
  "Social Media Manager",
  "Photographer",
  "Videographer",
  "Journalist",
  "Media Officer",
  "Federation Staff",
  "Volunteer",
  "Security",
];

/** The fields shared by the add and edit forms. */
export function AccreditationFields({ a, teams }: { a?: any; teams: { team_id: string; name: string }[] }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Full name">
          <Input name="full_name" required defaultValue={a?.full_name ?? ""} />
        </Field>
        <Field label="Role" hint="What they do, as printed on the card.">
          <Input name="role" required list="accreditation-roles" defaultValue={a?.role ?? ""} placeholder="e.g. Photographer" />
          <datalist id="accreditation-roles">
            {ROLE_IDEAS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Category" hint="Decides the colour of the card.">
          <Select name="category" defaultValue={a?.category ?? "team_staff"}>
            {STAFF_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Club" hint="Leave empty for media or federation staff.">
          <Select name="team_id" defaultValue={a?.team_id ?? ""}>
            <option value="">— none —</option>
            {teams.map((t) => (
              <option key={t.team_id} value={t.team_id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Organisation" hint="For media: the outlet, e.g. GTV Sports+. Shown when there is no club.">
          <Input name="organisation" defaultValue={a?.organisation ?? ""} />
        </Field>
        <Field label="Valid until" hint="Empty means the end of the season.">
          <Input name="valid_until" type="date" defaultValue={a?.valid_until ?? ""} />
        </Field>
      </div>
      {a && (
        <Field label="Status" hint="A revoked card shows as not valid when scanned. Nothing is deleted.">
          <Select name="status" defaultValue={a.status ?? "active"}>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
          </Select>
        </Field>
      )}
      <Field label="Photo">
        <PhotoUpload name="photo" label="Photo" shape="square" currentUrl={a?.photo_url ?? null} />
      </Field>
    </>
  );
}
