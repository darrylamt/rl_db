"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { requireClub, getAppUser } from "@/lib/auth";
import { writeWithOptionalColumns } from "@/lib/optionalColumns";
import { cleanSecondaryPositions } from "@/lib/positions";
import { resolveImageUrl } from "@/lib/upload";
import { revalidatePath } from "next/cache";

/**
 * What a club may change about its own player.
 *
 * Deliberately not here: team_id, playing_status, category, gender, rating and
 * the scouted attributes. A club saying which club a player belongs to, or
 * whether they are registered, would be marking its own homework — those stay
 * with the federation.
 */
const CLUB_EDITABLE = [
  "photo_url",
  "position",
  "secondary_positions",
  "jersey_number",
  "date_of_birth",
  "height_cm",
  "weight_kg",
  "nationality",
  "phone",
  "email",
  "is_captain",
] as const;

function str(fd: FormData, k: string) {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  return v.trim() || null;
}

function intOrNull(fd: FormData, k: string) {
  const v = str(fd, k);
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * Confirms the player is actually this club's before anything is written.
 *
 * The player id arrives from a form, which makes it the caller's claim rather
 * than a fact. Without this a club could post another club's id and edit their
 * squad.
 */
async function ownedPlayer(playerId: string) {
  const { teamId } = await requireClub();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("players")
    .select("player_id, team_id, photo_url")
    .eq("player_id", playerId)
    .maybeSingle();

  if (!data) throw new Error("Player not found");
  if (data.team_id !== teamId) {
    throw new Error("That player is not on your squad");
  }
  return { supabase, teamId, photoUrl: data.photo_url as string | null };
}

export async function updateClubPlayer(playerId: string, fd: FormData) {
  const { supabase, photoUrl } = await ownedPlayer(playerId);

  // A file input posts an empty File, not an empty string, when nothing new
  // is chosen — reading it as text always looked blank and wiped the photo
  // on every save, not only one that touched the upload field.
  const position = str(fd, "position");
  const payload: Record<string, unknown> = {
    photo_url: await resolveImageUrl(fd, "photo", "player-photos", "players", photoUrl),
    position,
    secondary_positions: cleanSecondaryPositions(
      fd.getAll("secondary_positions"),
      position
    ),
    jersey_number: intOrNull(fd, "jersey_number"),
    date_of_birth: str(fd, "date_of_birth"),
    height_cm: intOrNull(fd, "height_cm"),
    weight_kg: intOrNull(fd, "weight_kg"),
    nationality: str(fd, "nationality"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    is_captain: fd.get("is_captain") === "on",
  };

  // Belt and braces: nothing outside the allowed list can reach the update,
  // whatever the form happens to post.
  for (const key of Object.keys(payload)) {
    if (!(CLUB_EDITABLE as readonly string[]).includes(key)) delete payload[key];
  }

  const { error } = await writeWithOptionalColumns(
    payload,
    ["secondary_positions"] as const,
    (values) => supabase.from("players").update(values).eq("player_id", playerId)
  );
  if (error) throw new Error(error.message);

  revalidatePath("/club/players");
  revalidatePath(`/club/players/${playerId}`);
}

/**
 * A club adding a player it has signed. The club is taken from the session,
 * never from the form, so a player can only ever be created onto your own
 * squad.
 */
export async function createClubPlayer(fd: FormData) {
  const { teamId } = await requireClub();
  const supabase = createAdminClient();

  const first_name = str(fd, "first_name");
  const last_name = str(fd, "last_name");
  if (!first_name || !last_name) throw new Error("First and last name are required");

  const user = await getAppUser();
  const photoUrl = await resolveImageUrl(fd, "photo", "player-photos", "players", null);

  // Pending, not on the register. A club naming a player is a claim; the
  // federation decides who is actually registered. The columns arrive with
  // supabase/player_approvals.sql — until it is run the insert simply drops
  // them and behaves as it did before.
  const { error } = await writeWithOptionalColumns(
    {
    first_name,
    last_name,
    team_id: teamId,
    position: str(fd, "position"),
    secondary_positions: cleanSecondaryPositions(
      fd.getAll("secondary_positions"),
      str(fd, "position")
    ),
    jersey_number: intOrNull(fd, "jersey_number"),
    date_of_birth: str(fd, "date_of_birth"),
    height_cm: intOrNull(fd, "height_cm"),
    weight_kg: intOrNull(fd, "weight_kg"),
    nationality: str(fd, "nationality"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    photo_url: photoUrl,
    // A new player is on record but not registered — that is the federation's
    // to grant, for a season.
    playing_status: "inactive",
    approval_status: "pending",
    submitted_by: user?.userId ?? null,
    submitted_at: new Date().toISOString(),
    },
    [
      "approval_status",
      "submitted_by",
      "submitted_at",
      "secondary_positions",
    ] as const,
    (values) => supabase.from("players").insert(values)
  );
  if (error) throw new Error(error.message);

  revalidatePath("/club/players");
}
