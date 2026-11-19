import { redirect } from "next/navigation";

/** The list lives with the cards. */
export default function AccreditationsIndex() {
  redirect("/admin/id-cards?kind=staff");
}
