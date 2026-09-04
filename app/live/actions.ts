"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { kickoffAt } from "@/lib/predictions";
import { revalidatePath } from "next/cache";

/**
 * Casts (or changes) one browser's prediction for a fixture.
 *
 * device_id is a random id the browser made up for itself and kept in
 * localStorage — there is no fan login here, so this is the only "who" a
 * vote can be tied to. An upsert rather than an insert, so changing your
 * mind re-votes instead of failing on the unique pair.
 */
export async function castPrediction(
  fixtureId: string,
  deviceId: string,
  choice: "home" | "away"
) {
  if (!fixtureId || !deviceId) throw new Error("Missing fixture or device id");
  if (choice !== "home" && choice !== "away") throw new Error("Invalid choice");

  const supabase = createAdminClient();

  // A prediction made after kick-off is not a prediction. The card hides the
  // buttons, but that is presentation — this is the part that decides.
  const { data: fixture } = await supabase
    .from("fixtures")
    .select("scheduled_date, scheduled_time, status")
    .eq("fixture_id", fixtureId)
    .maybeSingle();

  if (fixture) {
    const f = fixture as any;
    if (f.status && !["scheduled", "postponed"].includes(f.status)) {
      throw new Error("That match has already started");
    }
    const closesAt = kickoffAt(f.scheduled_date, f.scheduled_time);
    if (closesAt && Date.now() >= closesAt) {
      throw new Error("Predictions closed at kick-off");
    }
  }
  const { error } = await supabase
    .from("match_predictions")
    .upsert(
      { fixture_id: fixtureId, device_id: deviceId, choice },
      { onConflict: "fixture_id,device_id" }
    );

  // The table arrives with supabase/match_predictions.sql — until it is run
  // a vote simply does not stick, rather than breaking the page.
  if (error && !/relation .* does not exist/i.test(error.message)) {
    throw new Error(error.message);
  }

  revalidatePath("/live");
}
