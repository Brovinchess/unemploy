"use server";

import { and, desc, eq, gte, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { startSearch } from "@/lib/start-search";

export type RunResult = { username: string; label: string; ok: boolean; note: string };

// Owner-side: start a search for one headhunter with its own settings, as if the person had
// pressed Find new jobs. The person pays for it from their Mind's cognition.
export async function runSearchFor(profileId: string): Promise<RunResult> {
  await requireAdmin();
  const profile = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, profileId) });
  if (!profile) return { username: "?", label: "?", ok: false, note: "No such headhunter." };
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, profile.userId) });
  if (!user) return { username: "?", label: profile.label, ok: false, note: "No such user." };
  const r = await startSearch(user, profile, profile.preferences?.jobsPerDay ?? 5, "").catch((e) => ({ error: String(e?.message ?? e) }));
  return { username: user.username ?? "(no name yet)", label: profile.label, ok: !r?.error, note: r?.error ?? "Search started." };
}

// Headhunters whose last search came back short (or who never searched), not searching now,
// with cognition left for another go.
export async function shortCandidates(zeroOnly = true, minBalance = 40) {
  const admin = await requireAdmin();
  const rows = await db
    .select({ id: schema.profiles.id, username: schema.users.username, label: schema.profiles.label, balance: schema.profiles.balanceCache })
    .from(schema.profiles)
    .innerJoin(schema.users, eq(schema.users.id, schema.profiles.userId))
    .where(
      and(
        eq(schema.profiles.status, "hunting"),
        isNotNull(schema.profiles.mindId),
        isNotNull(schema.profiles.conversationAlias),
        or(isNull(schema.profiles.searchStartedAt), isNotNull(schema.profiles.searchEndedAt)),
        gte(schema.profiles.balanceCache, minBalance),
        zeroOnly
          ? sql`coalesce((select coalesce(s.jobs_added, 0) = 0 from searches s where s.profile_id = ${schema.profiles.id} order by s.started_at desc limit 1), true)`
          : sql`coalesce((select coalesce(s.jobs_added, 0) < s.jobs_wanted from searches s where s.profile_id = ${schema.profiles.id} order by s.started_at desc limit 1), true)`,
        sql`${schema.profiles.userId} <> ${admin.id}`, // the owner runs their own by hand
      ),
    )
    .orderBy(desc(schema.profiles.balanceCache));
  return rows.map((r) => ({ id: r.id, username: r.username ?? "(no name yet)", label: r.label, balance: Math.round(r.balance ?? 0) }));
}

// Re-runs a search for every short candidate, one after another. Returns what happened to each.
export async function rerunShortSearches(zeroOnly = true): Promise<RunResult[]> {
  await requireAdmin();
  const out: RunResult[] = [];
  for (const c of await shortCandidates(zeroOnly)) {
    out.push(await runSearchFor(c.id));
    await new Promise((r) => setTimeout(r, 1500));
  }
  return out;
}
