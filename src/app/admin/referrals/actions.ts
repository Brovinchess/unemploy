"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { isAdmin } from "@/lib/admin";

export async function markRewarded(id: string) {
  const user = await requireUser();
  if (!isAdmin(user.username)) return;
  await db
    .update(schema.referrals)
    .set({ status: "rewarded", rewardedAt: new Date() })
    .where(and(eq(schema.referrals.id, id), eq(schema.referrals.status, "qualified")));
  revalidatePath("/admin/referrals");
}
