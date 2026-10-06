import { redirect } from "next/navigation";

// Extension setup moved into Settings.
export default function Extension() {
  redirect("/app/settings#extension");
}
