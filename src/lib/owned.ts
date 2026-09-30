import "server-only";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import type { User } from "@/db/schema";

export async function ownedProfile(user: User, profileId: string) {
  const p = await db.query.profiles.findFirst({
    where: and(eq(schema.profiles.id, profileId), eq(schema.profiles.userId, user.id)),
  });
  if (!p) notFound();
  return p;
}

export async function ownedJob(user: User, jobId: string) {
  const job = await db.query.jobs.findFirst({ where: eq(schema.jobs.id, jobId) });
  if (!job) notFound();
  const profile = await ownedProfile(user, job.profileId);
  return { job, profile };
}
