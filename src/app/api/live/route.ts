import { after, NextResponse, type NextRequest } from "next/server";
import { and, count, eq, gte, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Live } from "@/components/live";
import { balanceFor, freshBalance } from "@/lib/app-context";
import { ownedProfile } from "@/lib/owned";
import { questionCounts } from "@/lib/personal";
import { endSearch, isSearching, nudgeIfQuiet, sleepIfPacksDone } from "@/lib/search";
import { getCurrentUser } from "@/lib/session";

// One small snapshot of everything the app shows live: the current search, cognition,
// new-job and answer counts. Polled by LiveProvider; nothing here is cached.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "signed out" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("profile") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "profile required" }, { status: 400 });
  const profile = await ownedProfile(user, id);
  const live = await snapshot(user, profile);
  // Housekeeping that shouldn't wait for a page load or the daily job.
  after(async () => {
    if (profile.searchStartedAt && !profile.searchEndedAt && !isSearching(profile)) await endSearch(profile, "timeout").catch(() => {});
    else if (live.profile.searching && live.profile.balance != null && live.profile.balance <= 0) await endSearch(profile, "no_cognition").catch(() => {});
    else {
      await nudgeIfQuiet(profile).catch(() => {});
      await sleepIfPacksDone(profile).catch(() => {});
    }
  });
  return NextResponse.json(live, { headers: { "Cache-Control": "no-store" } });
}

type User = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
type Profile = Awaited<ReturnType<typeof ownedProfile>>;

export async function snapshot(user: User, profile: Profile): Promise<Live> {
  const mine = await db.query.profiles.findMany({ where: eq(schema.profiles.userId, user.id), columns: { id: true, status: true } });
  const ready = mine.filter((p) => p.status === "hunting" || p.status === "paused").map((p) => p.id);
  const searching = isSearching(profile);

  const [balance, [{ n: newJobs }], [{ n: toApply }], [{ n: jobsFound }], counts] = await Promise.all([
    // Live from Hello Minds while a search spends; the 2-minute cache otherwise.
    searching ? freshBalance(user, profile) : balanceFor(user, profile),
    ready.length ? db.select({ n: count() }).from(schema.jobs).where(and(inArray(schema.jobs.profileId, ready), eq(schema.jobs.status, "new"))) : [{ n: 0 }],
    ready.length ? db.select({ n: count() }).from(schema.jobs).innerJoin(schema.packs, eq(schema.packs.jobId, schema.jobs.id)).where(and(inArray(schema.jobs.profileId, ready), eq(schema.jobs.status, "saved"))) : [{ n: 0 }],
    profile.searchStartedAt
      ? db.select({ n: count() }).from(schema.jobs).where(and(eq(schema.jobs.profileId, profile.id), gte(schema.jobs.createdAt, profile.searchStartedAt)))
      : [{ n: 0 }],
    questionCounts(user.id),
  ]);

  return {
    at: new Date().toISOString(),
    profile: {
      id: profile.id,
      searching,
      startedAt: searching ? (profile.searchStartedAt?.toISOString() ?? null) : null,
      lastDeliveryAt: profile.lastDeliveryAt?.toISOString() ?? null,
      jobsFound: searching ? jobsFound : 0,
      balance,
    },
    newJobs,
    toApply,
    answers: { forYou: counts.forYou + (user.applicant ? 0 : 1) }, // missing details count as one thing to do
  };
}
