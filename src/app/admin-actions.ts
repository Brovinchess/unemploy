"use server";

import { and, desc, eq, gte, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { endSearch, isSearching } from "@/lib/search";
import { decrypt } from "@/lib/crypto";
import { tokenClaimKeys, tokenEmail } from "@/lib/minds/oauth";
import { startSearch } from "@/lib/start-search";
import { preferencesSchema } from "@/lib/preferences";
import { freshBalance } from "@/lib/app-context";
import { minds } from "@/lib/minds/client";
import { forget } from "@/lib/admin-data";

export type RunResult = { username: string; label: string; ok: boolean; note: string };

// Owner-side: start a search for one headhunter with its own settings, as if the person had
// pressed Find new jobs. The person pays for it from their Mind's cognition.
export async function runSearchFor(profileId: string, jobs?: number, via: "admin" | "rerun" = "admin"): Promise<RunResult> {
  await requireAdmin();
  const profile = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, profileId) });
  if (!profile) return { username: "?", label: "?", ok: false, note: "No such headhunter." };
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, profile.userId) });
  if (!user) return { username: "?", label: profile.label, ok: false, note: "No such user." };
  const r = await startSearch(user, profile, jobs ?? profile.preferences?.jobsPerDay ?? 5, "", { fitToBalance: true, via }).catch((e) => ({ error: String(e?.message ?? e) }));
  const open = r?.error ? null : await db.query.searches.findFirst({ where: and(eq(schema.searches.profileId, profile.id), isNull(schema.searches.endedAt)), columns: { jobsWanted: true } });
  return { username: user.username ?? "(no name yet)", label: profile.label, ok: !r?.error, note: r?.error ?? `Search started${open ? ` for ${open.jobsWanted} jobs` : ""}.` };
}

// Owner-side: change what a headhunter looks for, when a person has asked for help or a title
// clearly needs a neighbour. The Mind gets the full brief again with its next request.
export async function setRolesFor(profileId: string, roles: string): Promise<{ ok: boolean; note: string }> {
  await requireAdmin();
  const profile = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, profileId) });
  if (!profile?.preferences) return { ok: false, note: "No preferences to change." };
  if (isSearching(profile)) return { ok: false, note: "A search is running; change it after." };
  const parsed = preferencesSchema.safeParse({ ...profile.preferences, targetRoles: roles });
  if (!parsed.success) return { ok: false, note: "Titles must be 2 to 300 characters." };
  await db.update(schema.profiles).set({ preferences: parsed.data, prefsChangedAt: new Date() }).where(eq(schema.profiles.id, profile.id));
  return { ok: true, note: `Now looking for: ${parsed.data.targetRoles}` };
}

// Headhunters whose last search came back short (or who never searched), not searching now,
// with cognition left for another go.
export async function shortCandidates(zeroOnly = true, minBalance = 40) {
  const admin = await requireAdmin();
  await closeStaleSearches();
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

// A search past its time limit is closed as a timeout, the way the daily watchdog would; without
// this, a headhunter whose Mind went quiet stays "searching" until the next morning and cannot
// be re-run.
export async function closeStaleSearches(): Promise<number> {
  await requireAdmin();
  const open = await db.query.profiles.findMany({ where: and(isNotNull(schema.profiles.searchStartedAt), isNull(schema.profiles.searchEndedAt)) });
  let n = 0;
  for (const p of open) {
    if (isSearching(p)) continue;
    await endSearch(p, "timeout").catch((e) => console.error("[admin] close stale search failed", p.id, e));
    n++;
  }
  return n;
}

// Re-runs a search for every short candidate, one after another. Returns what happened to each.
export async function rerunShortSearches(zeroOnly = true): Promise<RunResult[]> {
  await requireAdmin();
  const out: RunResult[] = [];
  for (const c of await shortCandidates(zeroOnly)) {
    out.push(await runSearchFor(c.id, undefined, "rerun"));
    await new Promise((r) => setTimeout(r, 1500));
  }
  return out;
}


// ---- Sign-in tokens: what they carry --------------------------------------------------------
// People who signed in before the email scope was asked for have tokens granted without it. If
// those tokens carry the address anyway, it can be filled in from here without a new sign-in.

export type TokenCheck = { checked: number; withEmail: number; fields: string[]; scopesSeen: string[] };

export async function tokenFieldCheck(): Promise<TokenCheck> {
  await requireAdmin();
  const people = await db.query.users.findMany({ where: isNotNull(schema.users.accessToken), columns: { id: true, accessToken: true, scope: true }, limit: 200 });
  const fields = new Set<string>();
  const scopes = new Set<string>();
  let withEmail = 0;
  for (const u of people) {
    let token = "";
    try {
      token = decrypt(u.accessToken!);
    } catch {
      continue;
    }
    for (const k of tokenClaimKeys(token)) fields.add(k);
    if (tokenEmail({ accessToken: token, refreshToken: "", expiresIn: 0 })) withEmail++;
    if (u.scope) scopes.add(u.scope);
  }
  return { checked: people.length, withEmail, fields: [...fields].sort(), scopesSeen: [...scopes] };
}

// Fills the email, as verified, for everyone whose token carries one and who has none yet.
export async function backfillEmailsFromTokens(): Promise<{ filled: number; checked: number }> {
  await requireAdmin();
  const people = await db.query.users.findMany({ where: and(isNotNull(schema.users.accessToken), isNull(schema.users.email)), columns: { id: true, accessToken: true }, limit: 500 });
  let filled = 0;
  for (const u of people) {
    try {
      const email = tokenEmail({ accessToken: decrypt(u.accessToken!), refreshToken: "", expiresIn: 0 });
      if (!email) continue;
      await db.update(schema.users).set({ email, emailVerifiedAt: new Date() }).where(eq(schema.users.id, u.id));
      filled++;
    } catch {}
  }
  return { filled, checked: people.length };
}

// Owner-side: read every live headhunter's cognition from Hello Minds now, instead of waiting
// for each person to open the app. Each read uses that person's own token.
export async function refreshBalances(): Promise<{ checked: number; empty: number; failed: number }> {
  await requireAdmin();
  const live = await db.query.profiles.findMany({ where: and(isNotNull(schema.profiles.mindId), or(eq(schema.profiles.status, "hunting"), eq(schema.profiles.status, "paused"))) });
  const owners = new Map((await db.query.users.findMany({ where: sql`${schema.users.id} in ${live.length ? sql`(${sql.join(live.map((p) => sql`${p.userId}`), sql`, `)})` : sql`('')`}` })).map((u) => [u.id, u]));
  let checked = 0, empty = 0, failed = 0;
  // A few at a time: one Hello Minds call per headhunter.
  for (let i = 0; i < live.length; i += 5) {
    await Promise.all(
      live.slice(i, i + 5).map(async (p) => {
        const user = owners.get(p.userId);
        if (!user?.refreshToken) return failed++;
        const before = p.balanceCache;
        const b = await freshBalance(user, p);
        if (b == null || (b === before && p.balanceCachedAt && Date.now() - p.balanceCachedAt.getTime() < 1000)) return failed++;
        checked++;
        if (b <= 0) empty++;
      }),
    );
  }
  forget("users:");
  forget("headhunters:");
  forget("overview:");
  return { checked, empty, failed };
}

// Owner-side, read-only: for every live headhunter, every Mind on the owner's Hello Minds account.
// Tells apart people who were new to Hello Minds from people who had Minds before ours.
export type MindHistoryRow = {
  username: string; userId: string; joined: string; balance: number | null; ours: string; total: number; older: number; oldest: string | null; error?: string;
};
export async function mindHistory(): Promise<MindHistoryRow[]> {
  await requireAdmin();
  const live = await db.query.profiles.findMany({ where: and(isNotNull(schema.profiles.mindId), or(eq(schema.profiles.status, "hunting"), eq(schema.profiles.status, "paused"))) });
  const byUser = new Map<string, typeof live>();
  for (const p of live) byUser.set(p.userId, [...(byUser.get(p.userId) ?? []), p]);
  const owners = await db.query.users.findMany({ where: sql`${schema.users.id} in ${byUser.size ? sql`(${sql.join([...byUser.keys()].map((id) => sql`${id}`), sql`, `)})` : sql`('')`}` });
  const out: MindHistoryRow[] = [];
  for (let i = 0; i < owners.length; i += 5) {
    await Promise.all(
      owners.slice(i, i + 5).map(async (u) => {
        const mine = byUser.get(u.id) ?? [];
        const ourIds = new Set(mine.map((p) => p.mindId));
        const firstOurs = Math.min(...mine.map((p) => p.createdAt.getTime()));
        const base = { username: u.username ?? "(no name yet)", userId: u.id, joined: u.createdAt.toISOString().slice(0, 10), balance: mine.reduce<number | null>((a, p) => (p.balanceCache == null ? a : (a ?? 0) + p.balanceCache), null), ours: mine.map((p) => p.mindName ?? "").join(", ") };
        if (!u.refreshToken) return out.push({ ...base, total: 0, older: 0, oldest: null, error: "signed out, no token" });
        try {
          const list = await minds(u).listMinds();
          const others = list.filter((m) => !ourIds.has(m.mindId));
          // "Older" means made before this person's first Career Ninja headhunter, by more than an hour.
          const older = others.filter((m) => m.createdAt && m.createdAt.getTime() < firstOurs - 3_600_000);
          const dates = list.map((m) => m.createdAt?.getTime()).filter((t): t is number => !!t);
          out.push({ ...base, total: list.length, older: older.length, oldest: dates.length ? new Date(Math.min(...dates)).toISOString().slice(0, 10) : null });
        } catch (e) {
          out.push({ ...base, total: 0, older: 0, oldest: null, error: String((e as Error)?.message ?? e).slice(0, 120) });
        }
      }),
    );
  }
  return out.sort((a, b) => (a.balance ?? 0) - (b.balance ?? 0));
}
