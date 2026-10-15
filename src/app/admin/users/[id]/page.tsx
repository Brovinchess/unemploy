import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { APPLIED_PLUS, KEPT, WAITING_QUESTION, daysAgo, maskEmail, maskPhone, mins, stageLabel, sum, when } from "@/lib/admin";
import { summarizePreferences } from "@/lib/preferences";
import { Badge, Breadcrumb, Card, Clamp, Empty, Ext, Facts, Hero, Page, PageHead, SectionTitle, Stat, Table, Tiles, UserLink, endTone, hhTone, stageTone } from "../../ui";

const MAX_ROWS = 500;

// Everything about one account, read-only. There is no way to act as the person from here.
export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  if (!user) notFound();
  const now = daysAgo(0);
  const profiles = await db.query.profiles.findMany({ where: eq(schema.profiles.userId, id), orderBy: desc(schema.profiles.createdAt) });
  const pids = profiles.map((p) => p.id);
  const none = pids.length === 0;
  const [searches, jobs, questions, tokens, sessions, made, received, referrer, referredUsers] = await Promise.all([
    none ? [] : db.query.searches.findMany({ where: inArray(schema.searches.profileId, pids), orderBy: desc(schema.searches.startedAt), limit: MAX_ROWS }),
    none ? [] : db.query.jobs.findMany({ where: inArray(schema.jobs.profileId, pids), orderBy: desc(schema.jobs.createdAt), limit: MAX_ROWS }),
    db.query.questions.findMany({ where: eq(schema.questions.userId, id), orderBy: desc(schema.questions.createdAt) }),
    db.query.extensionTokens.findMany({ where: eq(schema.extensionTokens.userId, id), columns: { id: true, createdAt: true, lastUsedAt: true } }),
    db.query.sessions.findMany({ where: eq(schema.sessions.userId, id), columns: { expiresAt: true } }),
    db.query.referrals.findMany({ where: eq(schema.referrals.referrerId, id) }),
    db.query.referrals.findMany({ where: eq(schema.referrals.referredId, id) }),
    user.referredBy ? db.query.users.findFirst({ where: eq(schema.users.referralCode, user.referredBy), columns: { id: true, username: true } }) : null,
    // Names for both sides of the referral rows (all usernames; a small table).
    db.query.users.findMany({ columns: { id: true, username: true } }),
  ]);
  const name = new Map(referredUsers.map((u) => [u.id, u.username ?? "(no name yet)"]));
  const label = new Map(profiles.map((p) => [p.id, p.label]));
  const a = user.applicant;
  const main = profiles.find((p) => p.status === "hunting" || p.status === "paused") ?? profiles[0];
  const waiting = questions.filter((x) => WAITING_QUESTION.has(x.status));
  const QUESTION_LABEL: Record<string, string> = { review: "Answered, waiting for a check", needs_you: "Needs the person", ignored: "Ignored", new: "Needs the person (legacy)", asked: "Needs the person (legacy)" };

  const keptN = jobs.filter((j) => KEPT.has(j.status)).length;
  const appliedN = jobs.filter((j) => APPLIED_PLUS.has(j.status)).length;
  const displayName = user.username ?? "(no name yet)";

  return (
    <Page>
      <PageHead section="Users" title={displayName} description={`Joined ${when(user.createdAt)}. Read-only: there is no way to act as this person from the admin.`} />
      <div className="mt-5">
        <Breadcrumb items={[["Users", "/admin/users"], [displayName]]} />
      </div>
      <Hero
        mood={keptN > 0 ? "happy" : "thinking"}
        title={keptN > 0 ? `Kept ${keptN} ${keptN === 1 ? "job" : "jobs"}` : jobs.length ? "Got jobs, kept none yet" : searches.length ? "Searched, nothing delivered yet" : main?.mindId ? "Deployed, never searched" : "Still setting up"}
        subtitle={main ? `${main.label}${main.mindName ? ` (${main.mindName})` : ""} · ${main.status.replace(/_/g, " ")}` : "No headhunter yet."}
        badge={main ? <Badge tone={hhTone(main.status)}>{main.status.replace(/_/g, " ")}</Badge> : undefined}
      >
        <div className="mt-3">
          <Facts
            rows={[
              ["Email", user.email ? <span key="e">{user.email} <Badge tone={user.emailVerifiedAt ? "green" : "muted"}>{user.emailVerifiedAt ? "verified" : "not verified"}</Badge></span> : ""],
              ["Referred by", referrer ? <Link key="r" href={`/admin/users/${referrer.id}`} className="text-white underline decoration-white/20 underline-offset-2 hover:decoration-coral">{referrer.username ?? "(no name yet)"}</Link> : user.referredBy ? `code ${user.referredBy}` : ""],
              ["Extension", tokens.length ? `connected, ${tokens.length} ${tokens.length === 1 ? "token" : "tokens"}` : "not connected"],
            ]}
          />
        </div>
      </Hero>

      <Tiles cols={6} className="mt-6">
        <Stat label="Searches" value={searches.length} />
        <Stat label="Jobs" value={jobs.length} />
        <Stat label="Kept" value={keptN} />
        <Stat label="Applied+" value={appliedN} />
        <Stat label="Cognition" value={Math.round(sum(searches, (s) => s.cognitionUsed))} />
        <Stat label="Sessions" value={sessions.length} hint={`${sessions.filter((s) => s.expiresAt > now).length} still valid`} />
      </Tiles>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Account">
          <Facts
            rows={[
              ["Username", user.username ?? ""],
              ["Email", user.email ? `${user.email} ${user.emailVerifiedAt ? "(verified)" : "(not verified)"}` : ""],
              ["Email when a search ends", user.emailOnSearchDone ? "yes" : "no"],
              ["Coach reminders", user.coachReminders ? "on" : "off"],
              ["Timezone", user.timezone ?? ""],
              ["Referral code", user.referralCode ?? ""],
              ["Signed up with code", user.referredBy ?? ""],
              ["Hello Minds referral link", user.hmReferralUrl ? "pasted in" : ""],
              ["Retired personal Mind", user.personalMindId ? `${user.personalMindName ?? "yes"} (retired)` : ""],
              ["Scope", user.scope ?? ""],
            ]}
          />
        </Card>
        <Card title="Application details" hint="What the extension types into forms. Contact details are masked here.">
          {a ? (
            <Facts
              rows={[
                ["Name", `${a.firstName} ${a.lastName}`.trim()],
                ["Email", maskEmail(a.email)],
                ["Phone", maskPhone(a.phone)],
                ["Location", a.location],
                ["LinkedIn", a.linkedin ?? ""],
                ["Website", a.website ?? ""],
                ["Work authorization", a.workAuthorization ?? ""],
                ["Notice period", a.noticePeriod ?? ""],
                ["Salary expectation", a.salaryExpectation ?? ""],
                ["Current role", [a.currentTitle, a.currentCompany].filter(Boolean).join(" at ")],
              ]}
            />
          ) : (
            <Empty mood="thinking">Not filled in yet.</Empty>
          )}
        </Card>
      </div>

      <SectionTitle title={`Headhunter${profiles.length > 1 ? `s (${profiles.length})` : ""}`} />
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        {profiles.map((p) => (
          <Card
            key={p.id}
            title={
              <span className="flex flex-wrap items-center gap-2">
                {p.label}
                {p.mindName && <span className="admin-text-3 font-mono text-sm">{p.mindName}</span>}
                <Badge tone={hhTone(p.status)}>{p.status.replace(/_/g, " ")}</Badge>
              </span>
            }
            hint={p.id === main?.id && profiles.length > 1 ? "Main headhunter" : undefined}
          >
            <Facts
              rows={[
                ["Deployed", p.mindId ? "yes" : "no"],
                ["Resume", p.resumeFileName ?? ""],
                ["Briefed", when(p.briefedAt)],
                ["Last delivery", when(p.lastDeliveryAt)],
                ["Searching now", p.searchStartedAt && !p.searchEndedAt ? `since ${when(p.searchStartedAt)}` : "no"],
                ["Balance (cached)", p.balanceCache != null ? `${Math.round(p.balanceCache)} at ${when(p.balanceCachedAt)}` : ""],
                ["Created", when(p.createdAt)],
                ...(p.preferences ? summarizePreferences(p.preferences).map((r) => [r.label, r.value] as [string, string]) : ([["Preferences", "not set"]] as [string, string][])),
              ]}
            />
          </Card>
        ))}
        {!profiles.length && (
          <div className="admin-panel rounded-2xl">
            <Empty mood="sleeping">No headhunter yet.</Empty>
          </div>
        )}
      </div>

      <SectionTitle title={`Searches (${searches.length})`} />
      <div className="mt-3">
        <Table
          head={["Started", "Headhunter", "Asked", "Got", "Cognition", "Took", "Ended", "Focus"]}
          empty="No searches yet."
          emptyMood="sleeping"
          rows={searches.map((s) => {
            const m = mins(s.startedAt, s.endedAt);
            return [
              <Link key={s.id} href={`/admin/searches/${s.id}`} className="text-white underline decoration-white/20 underline-offset-2 hover:decoration-coral">{when(s.startedAt)}</Link>,
              label.get(s.profileId) ?? "?",
              s.jobsWanted,
              s.jobsAdded ?? (s.endedAt ? 0 : "…"),
              s.cognitionUsed != null ? Math.round(Number(s.cognitionUsed)) : "",
              m ? `${m} min` : "running",
              <Badge key="e" tone={endTone(s.endReason, !s.endedAt)}>{s.endReason ?? (s.endedAt ? "ended" : "open")}</Badge>,
              <Clamp key="f" text={s.focus} className="max-w-xs" />,
            ];
          })}
        />
        {searches.length >= MAX_ROWS && <p className="admin-text-3 mt-2 text-xs">Showing the latest {MAX_ROWS}.</p>}
      </div>

      <SectionTitle title={`Jobs (${jobs.length})`} />
      <div className="mt-3">
        <Table
          head={["When", "Company", "Title", "Match", "Place", "Stage", "Stage changed"]}
          empty="No jobs delivered yet."
          emptyMood="sleeping"
          rows={jobs.map((j) => [when(j.createdAt), j.company, <Ext key={j.id} href={j.url}>{j.title}</Ext>, `${Math.round(j.matchScore)}%`, [j.city, j.country].filter(Boolean).join(", "), <Badge key="s" tone={stageTone(j.status)}>{stageLabel(j.status)}</Badge>, when(j.statusChangedAt)])}
        />
        {jobs.length >= MAX_ROWS && <p className="admin-text-3 mt-2 text-xs">Showing the latest {MAX_ROWS}.</p>}
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <div>
          <SectionTitle className="" title={`Questions (${questions.length})`} hint={`${waiting.length} waiting on the person.`} />
          <div className="mt-3">
            <Table
              head={["Status", "Question", "Company", "Asked"]}
              rows={questions.map((x) => [<Badge key="s" tone={WAITING_QUESTION.has(x.status) ? "amber" : x.status === "ignored" ? "muted" : "teal"}>{QUESTION_LABEL[x.status] ?? x.status}</Badge>, <Clamp key="q" text={x.question} />, x.company ?? "", when(x.askedAt ?? x.createdAt)])}
              empty="No form questions yet."
            />
          </div>
        </div>
        <div>
          <SectionTitle className="" title={`Saved answers (${user.savedAnswers?.length ?? 0})`} hint="Reused by the extension on later forms." />
          <div className="mt-3">
            <Table head={["Question", "Answer", "Updated"]} rows={(user.savedAnswers ?? []).map((x) => [x.question, <span key="a" className="block max-w-md whitespace-pre-wrap">{x.answer}</span>, x.updatedAt.slice(0, 10)])} empty="No saved answers." />
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        <Card title={`Referrals made (${made.length})`}>
          <Table head={["Friend", "Status", "Joined"]} rows={made.map((r) => [<UserLink key={r.id} id={r.referredId} name={name.get(r.referredId) ?? "?"} />, r.status, when(r.createdAt)])} empty="Nobody yet." />
        </Card>
        <Card title="Referred by">
          <Table head={["Referrer", "Status", "Joined"]} rows={received.map((r) => [<UserLink key={r.id} id={r.referrerId} name={name.get(r.referrerId) ?? "?"} />, r.status, when(r.createdAt)])} empty="Signed up without a link." />
        </Card>
        <Card title={`Extension tokens (${tokens.length})`} hint="Only when they were made and last used; never the token itself.">
          <Table head={["Created", "Last used"]} rows={tokens.map((t) => [when(t.createdAt), when(t.lastUsedAt) || "never"])} empty="Extension not connected." />
        </Card>
      </div>
    </Page>
  );
}
