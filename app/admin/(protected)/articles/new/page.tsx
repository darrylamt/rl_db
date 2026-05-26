import { redirect } from "next/navigation";
import { createArticle } from "../actions";

// Creates a blank draft article and redirects to its editor page.
export default async function NewArticlePage() {
  const id = await createArticle();
  redirect(`/admin/articles/${id}`);
}
