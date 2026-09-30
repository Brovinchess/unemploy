import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Profile, User } from "@/db/schema";
import { minds } from "./minds/client";
import { requireUser } from "./session";

export async function appContext(profileParam?: string | string[]) {
  const user = await requireUser();
  const all = await db.query.profiles.findMany({
    where: eq(schema.profiles.userId, user.id),
    orderBy: asc(schema.profiles.createdAt),
  });
  const ready = all.filter((p) => p.status === "hunting" || p.status === "paused");
  if (!ready.length) redirect("/start");
  const wanted = typeof profileParam === "string" ? profileParam : undefined;
  const current = ready.find((p) => p.id === wanted) ?? ready[0];
  return { user, profiles: ready, current };
}

// Balance is read live from Hello Minds; null when it can't be reached.
export const balanceFor = cache(async (user: User, profile: Profile): Promise<number | null> => {
  if (!profile.mindId) return null;
  try {
    return await minds(user).getBalance(profile.mindId);
  } catch (e) {
    console.error("[balance]", e);
    return null;
  }
});
