import { sortParams, when } from "@/lib/admin";
import { USER_STAGES, users, type UserStage } from "@/lib/admin-data";
import { Badge, Cap, Check, ClearLink, FilterForm, Page, PageHead, Select, SortLink, Stat, Table, TextInput, Tiles, UserLink, type Tone } from "../ui";
import { MindHistory, RefreshBalances } from "../headhunters/run-buttons";

const BASE = "/admin/users";
const MAX_ROWS = 500;

// Where each person is on the journey, one word each, coloured from grey to green.
const STAGE_TONE: Record<UserStage, Tone> = { no_name: "muted", setting_up: "slate", ready: "slate", searched: "amber", got_jobs: "teal", kept: "blue", applied: "green" };
const STAGE_LABEL = Object.fromEntries(USER_STAGES) as Record<UserStage, string>;

export default async function Users({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const { key, dir } = sortParams(q, "joined");
  const { total, allUsers, deployedUsers, rows, tiles } = await users({
    q: q.q || undefined,
    deployed: !!q.deployed,
    active: q.active ? Math.max(1, Number(q.active) || 7) : undefined,
    idle: !!q.idle,
    nokeep: !!q.nokeep,
    stage: q.stage || undefined,
    sort: key,
    dir,
  });
  const col = (k: string, label: string) => <SortLink k={k} label={label} base={BASE} q={q} sort={key} dir={dir} />;
  const filtered = !!(q.q || q.deployed || q.active || q.idle || q.nokeep || q.stage);
  const dim = (n: number) => (n ? n : <span className="text-white/25">0</span>);

  return (
    <Page>
      <PageHead
        section="Users"
        title={`${total} ${filtered ? "matching" : "accounts"}`}
        description={`${allUsers} accounts in total. Each row is one person: where they are on the journey, what their headhunter has done, and how much cognition it has left.`}
        controls={
          <>
            <RefreshBalances />
            <FilterForm q={q}>
              <TextInput name="q" value={q.q} placeholder="Username or email" />
              <Select name="stage" value={q.stage} blank="Any stage" options={USER_STAGES} />
              <TextInput name="active" value={q.active} placeholder="Searched in last N days" size={20} />
              <Check name="deployed" checked={!!q.deployed} label="Set up" />
              <Check name="idle" checked={!!q.idle} label="Set up, never searched" />
              <Check name="nokeep" checked={!!q.nokeep} label="Searched, kept nothing" />
              {filtered && <ClearLink href={BASE} />}
            </FilterForm>
          </>
        }
      />

      {/* The whole base at a glance, all time. */}
      <Tiles cols={6} className="mt-6">
        <Stat label="Accounts" value={allUsers} hint={`${tiles.verified} with a verified email`} href={BASE} />
        <Stat label="Set up a headhunter" value={deployedUsers} hint={`${allUsers ? Math.round((deployedUsers / allUsers) * 100) : 0}% of accounts`} href={`${BASE}?deployed=1`} />
        <Stat label="Searched" value={tiles.searched} hint={`${tiles.kept} kept a job, ${tiles.applied} applied`} href={`${BASE}?active=365`} />
        <Stat label="Daily search on" value={tiles.dailyOn} hint="people" />
        <Stat label="Cognition left" value={tiles.balance} hint={`across ${tiles.balanceMinds} live headhunters`} href={`${BASE}?sort=balance&dir=desc`} />
        <Stat label="At zero" value={tiles.balanceEmpty} hint="headhunters with no cognition" href={`${BASE}?sort=balance&dir=asc`} />
      </Tiles>

      <MindHistory />

      <div className="mt-6">
        <Table
          head={[
            col("name", "Person"), col("joined", "Joined"), col("stage", "Stage"), col("label", "Headhunter"),
            col("searches", "Searches"), col("jobs", "Jobs found"), col("kept", "Kept"), col("applied", "Applied"),
            col("balance", "Cognition left"), col("cognition", "Cognition used"), col("daily", "Daily search"), col("lastSeen", "Last active"), col("referrer", "Referred by"),
          ]}
          empty="No accounts match these filters."
          rows={rows.map((r) => [
            <span key="p" className="flex flex-col">
              <UserLink id={r.id} name={r.name} />
              {r.email ? (
                <span className="admin-text-3 text-xs" title={r.email}>
                  {r.email.length > 30 ? `${r.email.slice(0, 28)}…` : r.email}
                  {r.emailVerified ? <span className="ml-1 text-emerald-300" title="verified">✓</span> : <span className="ml-1 text-amber-300/80" title="not verified yet">unverified</span>}
                </span>
              ) : (
                <span className="admin-text-3 text-xs text-white/30">no email</span>
              )}
            </span>,
            when(r.createdAt).slice(0, 10),
            <Badge key="s" tone={STAGE_TONE[r.stage]} title={r.hhStatus && r.stage === "setting_up" ? `headhunter: ${r.hhStatus}` : undefined}>{STAGE_LABEL[r.stage]}</Badge>,
            r.hhLabel ? <span key="l" title={r.hhStatus}>{r.hhLabel.length > 28 ? `${r.hhLabel.slice(0, 26)}…` : r.hhLabel}{r.hhRaw === "paused" ? <span className="admin-text-3 text-xs"> · paused</span> : null}</span> : <span key="l" className="text-white/25">–</span>,
            dim(r.searches),
            dim(r.jobs),
            dim(r.kept),
            dim(r.applied),
            r.balance == null ? (
              <span key="b" className="text-white/25">–</span>
            ) : (
              <span key="b" className={r.balance <= 0 ? "text-rose-300" : r.balance < 40 ? "text-amber-300" : ""} title={r.balanceAt ? `read ${when(r.balanceAt)}` : undefined}>
                {Math.round(r.balance)}
              </span>
            ),
            dim(r.cognition),
            r.daily === "on" ? <Badge key="d" tone="green">on</Badge> : r.daily === "paused" ? <Badge key="d" tone="amber">paused</Badge> : r.daily === "off" ? <span key="d" className="text-white/35">off</span> : <span key="d" className="text-white/25">–</span>,
            when(r.lastSeen),
            r.referrerId ? <UserLink key="r" id={r.referrerId} name={r.referrer} /> : <span key="r" className={r.referrer ? "" : "text-white/25"}>{r.referrer || "–"}</span>,
          ])}
        />
        <Cap shown={MAX_ROWS} total={total} />
        <p className="admin-text-3 mt-3 text-xs">
          Cognition left is the last figure read from Hello Minds for that person&rsquo;s headhunters, refreshed whenever they open the app or you press Refresh balances. Cognition used is the total their searches have spent.
          Extension, questions and saved answers are on each person&rsquo;s page.
        </p>
      </div>
    </Page>
  );
}
