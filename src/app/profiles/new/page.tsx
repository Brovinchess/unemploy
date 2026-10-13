import { redirect } from "next/navigation";

// Setup starts at the resume now, with the headhunter made on the way in (see /start).
export default function NewProfile() {
  redirect("/start");
}
