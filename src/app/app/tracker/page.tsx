import { redirect } from "next/navigation";

// The tracker now lives on the Jobs page.
export default function Tracker() {
  redirect("/app");
}
