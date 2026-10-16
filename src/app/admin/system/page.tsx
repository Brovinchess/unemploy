import { when } from "@/lib/admin";
import { system, type Freshness } from "@/lib/admin-data";
import { launchMode } from "@/lib/launch";
import { mindsMode } from "@/lib/minds/config";
import { Badge, Card, Counts, Empty, Facts, Page, PageHead, Stat, Tiles, type Tone } from "../ui";

const QUESTION_LABEL: Record<string, string> = { review: "Answered, waiting for a check", needs_you: "Needs the person", ignored: "Ignored", new: "Needs the person (legacy)", asked: "Needs the person (legacy)" };
const freshness = (f: Freshness) => (f.hours == null ? "never" : f.hours < 30 ? `${f.hours}h ago` : `${Math.round(f.hours / 24)} days ago`);
const fresh = (f: Freshness): Tone => (f.hours == null ? "muted" : f.hours < 30 ? "green" : f.hours < 72 ? "amber" : "rose");

// Health counters and the environment switches. No secrets: only which mode each one is in.
export default async function System() {
  const d = await system();
  const { verified, checked, expired } = d.watchdog;
  const questionTotal = d.questionsByStatus.reduce((a, r) => a + r.n, 0);
  const stale = (checked.hours ?? 0) > 48;

  return (
    <Page>
      <PageHead section="System" title="Health and switches" description="Counters that should move, the watchdog's freshness, and which mode each switch is in. No secrets." />
      <Tiles cols={4} className="mt-6">
        <Stat label="Active sessions" value={d.sessions} />
        <Stat label="Extension tokens" value={d.tokens} />
        <Stat label="Questions waiting on people" value={d.questions} href="/admin/applications" />
        <Stat label="Searches open right now" value={d.openSearches} href="/admin/searches?open=1" />
        <Stat label="Pushes from Minds, 24h" value={d.logs24h} />
        <Stat label="Pool: open postings" value={d.poolOpen} hint={`${d.poolFresh} seen this week`} />
        <Stat label="Pool: closed postings" value={d.poolClosed} />
      </Tiles>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card title="Watchdog" hint="The daily recheck of postings. Proxies: the newest things it touched.">
          <Facts
            rows={[
              ["Verified open", <span key="v"><Badge tone={fresh(verified)}>{freshness(verified)}</Badge> <span className="admin-text-3 ml-1 text-xs">{when(verified.at)}</span></span>],
              ["Checked", <span key="c"><Badge tone={fresh(checked)}>{freshness(checked)}</Badge> <span className="admin-text-3 ml-1 text-xs">{when(checked.at)}</span></span>],
              ["Job marked closed", <span key="e"><Badge tone={fresh(expired)}>{freshness(expired)}</Badge> <span className="admin-text-3 ml-1 text-xs">{when(expired.at)}</span></span>],
            ]}
          />
          {stale && <p className="mt-4 text-sm text-rose-300">Nothing checked in two days: is the cron running?</p>}
        </Card>
        <Card title="Pool by country" hint="Top 10 by postings; open ones in brackets.">
          <ul className="space-y-2 text-sm">
            {d.pool.map((r) => (
              <li key={r.country ?? "none"} className="flex justify-between gap-4">
                <span className="admin-text-2">{r.country ?? "unknown"}</span>
                <span className="tabular-nums text-white">{r.total} <span className="admin-text-3">({r.open} open)</span></span>
              </li>
            ))}
          </ul>
          {!d.pool.length && <Empty mood="sleeping">The pool is empty.</Empty>}
        </Card>
        <Counts title="Questions by status" total={questionTotal} rows={d.questionsByStatus.map((r) => [QUESTION_LABEL[r.status] ?? r.status, r.n] as [string, number]).sort((a, b) => b[1] - a[1])} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Counts title="Extension tokens by last use" total={d.tokens} rows={[["Used in the last 7 days", d.tokensByUse.last7], ["Used 7 to 30 days ago", d.tokensByUse.last30], ["Older", d.tokensByUse.older], ["Never used", d.tokensByUse.never]]} />
        <Card title="Switches" className="lg:col-span-2">
          <Facts
            rows={[
              ["Minds mode", <Badge key="m" tone="slate">{mindsMode}</Badge>],
              ["Launch mode", <Badge key="l" tone="slate">{launchMode}</Badge>],
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
