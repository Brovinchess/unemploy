import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";

// Sends a signed-in user to wherever they left off.
export default async function Start() {
  const user = await requireUser();
  if (!user.username) redirect("/welcome");

  const profiles = await db.query.profiles.findMany({ where: eq(schema.profiles.userId, user.id) });
  // A working headhunter wins: an unfinished second one is reachable from the sidebar.
  if (profiles.some((p) => p.status === "hunting" || p.status === "paused")) redirect("/app");
  const unfinished = profiles.find((p) => p.status !== "hunting" && p.status !== "paused");
  if (unfinished) redirect(`/profiles/${unfinished.id}/setup`);
  redirect("/profiles/new");
}
