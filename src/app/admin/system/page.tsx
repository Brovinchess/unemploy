import { and, count, gte, isNotNull, isNull, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { daysAgo } from "@/lib/admin";
import { extensionLive } from "@/lib/flags";
import { launchMode } from "@/lib/launch";
import { mindsMode } from "@/lib/minds/config";
import { Stat } from "../ui";

export default async function System() {
  const n = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
  const [sessions, tokens, questions, poolOpen, poolClosed, poolFresh, openSearches, logs24h] = await Promise.all([
    n(db.select({ n: count() }).from(schema.sessions).where(gte(schema.sessions.expiresAt, new Date()))),
    n(db.select({ n: count() }).from(schema.extensionTokens)),
    n(db.select({ n: count() }).from(schema.questions).where(ne(schema.questions.status, "ignored"))),
    n(db.select({ n: count() }).from(schema.postings).where(isNull(schema.postings.closedAt))),
    n(db.select({ n: count() }).from(schema.postings).where(isNotNull(schema.postings.closedAt))),
    n(db.select({ n: count() }).from(schema.postings).where(gte(schema.postings.lastSeenAt, daysAgo(7)))),
    n(db.select({ n: count() }).from(schema.profiles).where(and(isNotNull(schema.profiles.searchStartedAt), isNull(schema.profiles.searchEndedAt)))),
    n(db.select({ n: count() }).from(schema.ingestLog).where(gte(schema.ingestLog.createdAt, daysAgo(1)))),
  ]);
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <p className="text-sm text-white/45">System</p>
      <h1 className="font-display mt-1 text-3xl font-medium">Health and switches</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Active sessions" value={sessions} />
        <Stat label="Extension tokens" value={tokens} />
        <Stat label="Questions waiting on people" value={questions} />
        <Stat label="Searches open right now" value={openSearches} />
        <Stat label="Pushes from Minds, 24h" value={logs24h} />
        <Stat label="Pool: open postings" value={poolOpen} hint={`${poolFresh} seen this week`} />
        <Stat label="Pool: closed postings" value={poolClosed} />
      </div>
      <h2 className="font-display mt-10 text-xl font-medium">Switches</h2>
      <ul className="mt-3 space-y-2 text-sm text-white/75">
        <li>Minds mode: <b className="text-white">{mindsMode}</b></li>
        <li>Launch mode: <b className="text-white">{launchMode}</b></li>
        <li>Extension shown as live: <b className="text-white">{extensionLive ? "yes" : "no, coming soon"}</b></li>
        <li>Admins: <b className="text-white">{process.env.ADMIN_USERS ?? "rovinc (default)"}</b></li>
      </ul>
    </main>
  );
}
