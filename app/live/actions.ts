"use server";

import { castVote } from "@/lib/predictions";
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
  // The rules live in lib/predictions, shared with the public API the
  // website votes through.
  await castVote(fixtureId, deviceId, choice);
  revalidatePath("/live");
}
