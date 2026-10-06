import { redirect } from "next/navigation";

// Answers moved to the You page.
export default function Answers() {
  redirect("/app/you");
}
