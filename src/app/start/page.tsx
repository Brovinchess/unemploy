import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { ensureProfile } from "@/app/actions";

// Sends a signed-in user to wherever they left off.
export default async function Start() {
  const user = await requireUser();

  const profiles = await db.query.profiles.findMany({ where: eq(schema.profiles.userId, user.id) });
  // Nothing yet: straight to the resume. The name comes from the resume, so there's nothing to type first.
  if (!profiles.length) redirect(`/profiles/${await ensureProfile(user)}/setup`);
  // A working headhunter wins; an unfinished one goes back to its setup.
  if (profiles.some((p) => p.status === "hunting" || p.status === "paused")) redirect("/app");
  const unfinished = profiles.find((p) => p.status !== "hunting" && p.status !== "paused");
  if (unfinished) redirect(`/profiles/${unfinished.id}/setup`);
  redirect("/profiles/new");
}
