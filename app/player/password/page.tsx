import { redirect } from "next/navigation";

/**
 * The old address. Choosing a password now lives at /account/password,
 * which every kind of account shares; links and bookmarks still land there.
 */
export default function PlayerPasswordPage() {
  redirect("/account/password");
}
