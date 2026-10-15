import { and, count, desc, eq, gte, isNotNull, isNull, lt, max, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { daysAgo, when } from "@/lib/admin";
import { extensionLive } from "@/lib/flags";
import { launchMode } from "@/lib/launch";
import { mindsMode } from "@/lib/minds/config";
import { Badge, Card, Counts, Empty, Facts, Page, PageHead, Stat, Tiles } from "../ui";

// Health counters and the environment switches. No secrets: only which mode each one is in.
export default async function System() {
  const now = daysAgo(0);
  const n = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
  const [sessions, tokens, questions, poolOpen, poolClosed, poolFresh, openSearches, logs24h, watchdog, lastExpired, pool, qStatus, tok7, tok30, tokNever] = await Promise.all([
    n(db.select({ n: count() }).from(schema.sessions).where(gte(schema.sessions.expiresAt, now))),
    n(db.select({ n: count() }).from(schema.extensionTokens)),
    n(db.select({ n: count() }).from(schema.questions).where(ne(schema.questions.status, "ignored"))),
    n(db.select({ n: count() }).from(schema.postings).where(isNull(schema.postings.closedAt))),
    n(db.select({ n: count() }).from(schema.postings).where(isNotNull(schema.postings.closedAt))),
    n(db.select({ n: count() }).from(schema.postings).where(gte(schema.postings.lastSeenAt, daysAgo(7)))),
    n(db.select({ n: count() }).from(schema.profiles).where(and(isNotNull(schema.profiles.searchStartedAt), isNull(schema.profiles.searchEndedAt)))),
    n(db.select({ n: count() }).from(schema.ingestLog).where(gte(schema.ingestLog.createdAt, daysAgo(1)))),
    // Watchdog freshness: the newest posting it verified open, and the newest job it marked closed.
    db.select({ at: max(schema.postings.lastVerifiedOpenAt), checked: max(schema.postings.lastCheckedAt) }).from(schema.postings),
    db.select({ at: max(schema.jobs.statusChangedAt) }).from(schema.jobs).where(eq(schema.jobs.status, "expired")),
    // Pool by country, open and closed.
    db
      .select({ country: schema.postings.countryCode, total: count(), open: sql<number>`count(*) filter (where ${schema.postings.closedAt} is null)`.mapWith(Number) })
      .from(schema.postings)
      .groupBy(schema.postings.countryCode)
      .orderBy(desc(count()))
      .limit(10),
    db.select({ status: schema.questions.status, n: count() }).from(schema.questions).groupBy(schema.questions.status),
    n(db.select({ n: count() }).from(schema.extensionTokens).where(gte(schema.extensionTokens.lastUsedAt, daysAgo(7)))),
    n(db.select({ n: count() }).from(schema.extensionTokens).where(and(gte(schema.extensionTokens.lastUsedAt, daysAgo(30)), lt(schema.extensionTokens.lastUsedAt, daysAgo(7))))),
    n(db.select({ n: count() }).from(schema.extensionTokens).where(isNull(schema.extensionTokens.lastUsedAt))),
  ]);
  const verifiedAt = watchdog[0]?.at ?? null;
  const checkedAt = watchdog[0]?.checked ?? null;
  const expiredAt = lastExpired[0]?.at ?? null;
  const hoursSince = (d: Date | null) => (d ? Math.round((now.getTime() - d.getTime()) / 3_600_000) : null);
  const freshness = (d: Date | null) => {
    const h = hoursSince(d);
    return h == null ? "never" : h < 30 ? `${h}h ago` : `${Math.round(h / 24)} days ago`;
  };
  const QUESTION_LABEL: Record<string, string> = { review: "Answered, waiting for a check", needs_you: "Needs the person", ignored: "Ignored", new: "Needs the person (legacy)", asked: "Needs the person (legacy)" };
  const questionTotal = qStatus.reduce((a, r) => a + r.n, 0);
  const tokOlder = Math.max(0, tokens - tok7 - tok30 - tokNever);

  const stale = (hoursSince(checkedAt) ?? 0) > 48;
  const fresh = (d: Date | null) => {
    const h = hoursSince(d);
    return h == null ? "muted" : h < 30 ? "green" : h < 72 ? "amber" : "rose";
  };

  return (
    <Page>
      <PageHead section="System" title="Health and switches" description="Counters that should move, the watchdog's freshness, and which mode each switch is in. No secrets." />
      <Tiles cols={4} className="mt-6">
        <Stat label="Active sessions" value={sessions} />
        <Stat label="Extension tokens" value={tokens} />
        <Stat label="Questions waiting on people" value={questions} href="/admin/applications" />
        <Stat label="Searches open right now" value={openSearches} href="/admin/searches?open=1" />
        <Stat label="Pushes from Minds, 24h" value={logs24h} />
        <Stat label="Pool: open postings" value={poolOpen} hint={`${poolFresh} seen this week`} />
        <Stat label="Pool: closed postings" value={poolClosed} />
      </Tiles>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card title="Watchdog" hint="The daily recheck of postings. Proxies: the newest things it touched.">
          <Facts
            rows={[
              ["Verified open", <span key="v"><Badge tone={fresh(verifiedAt)}>{freshness(verifiedAt)}</Badge> <span className="admin-text-3 ml-1 text-xs">{when(verifiedAt)}</span></span>],
              ["Checked", <span key="c"><Badge tone={fresh(checkedAt)}>{freshness(checkedAt)}</Badge> <span className="admin-text-3 ml-1 text-xs">{when(checkedAt)}</span></span>],
              ["Job marked closed", <span key="e"><Badge tone={fresh(expiredAt)}>{freshness(expiredAt)}</Badge> <span className="admin-text-3 ml-1 text-xs">{when(expiredAt)}</span></span>],
            ]}
          />
          {stale && <p className="mt-4 text-sm text-rose-300">Nothing checked in two days: is the cron running?</p>}
        </Card>
        <Card title="Pool by country" hint="Top 10 by postings; open ones in brackets.">
          <ul className="space-y-2 text-sm">
            {pool.map((r) => (
              <li key={r.country ?? "none"} className="flex justify-between gap-4">
                <span className="admin-text-2">{r.country ?? "unknown"}</span>
                <span className="tabular-nums text-white">{r.total} <span className="admin-text-3">({r.open} open)</span></span>
              </li>
            ))}
          </ul>
          {!pool.length && <Empty mood="sleeping">The pool is empty.</Empty>}
        </Card>
        <Counts title="Questions by status" total={questionTotal} rows={qStatus.map((r) => [QUESTION_LABEL[r.status] ?? r.status, r.n] as [string, number]).sort((a, b) => b[1] - a[1])} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Counts title="Extension tokens by last use" total={tokens} rows={[["Used in the last 7 days", tok7], ["Used 7 to 30 days ago", tok30], ["Older", tokOlder], ["Never used", tokNever]]} />
        <Card title="Switches" className="lg:col-span-2">
          <Facts
            rows={[
              ["Minds mode", <Badge key="m" tone="slate">{mindsMode}</Badge>],
              ["Launch mode", <Badge key="l" tone="slate">{launchMode}</Badge>],
              ["Extension shown as live", <Badge key="x" tone={extensionLive ? "green" : "amber"}>{extensionLive ? "yes" : "no, coming soon"}</Badge>],
              ["Admins", process.env.ADMIN_USERS ?? "rovinc (default)"],
              ["Database", <Badge key="d" tone={process.env.DATABASE_URL || process.env.POSTGRES_URL ? "green" : "rose"}>{process.env.DATABASE_URL || process.env.POSTGRES_URL ? "configured" : "not set"}</Badge>],
              ["Vercel environment", <Badge key="v" tone={process.env.VERCEL_ENV === "production" ? "green" : "slate"}>{process.env.VERCEL_ENV ?? "local"}</Badge>],
            ]}
          />
        </Card>
      </div>
    </Page>
  );
}
