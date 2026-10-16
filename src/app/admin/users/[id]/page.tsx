import Link from "next/link";
import { notFound } from "next/navigation";
import { WAITING_QUESTION, maskEmail, maskPhone, stageLabel, when } from "@/lib/admin";
import { userDetail } from "@/lib/admin-data";
import { summarizePreferences } from "@/lib/preferences";
import { Badge, Breadcrumb, Card, Clamp, Empty, Ext, Facts, Hero, Page, PageHead, SectionTitle, Stat, Table, Tiles, UserLink, endTone, hhTone, stageTone } from "../../ui";

const MAX_ROWS = 500;
const QUESTION_LABEL: Record<string, string> = { review: "Answered, waiting for a check", needs_you: "Needs the person", ignored: "Ignored", new: "Needs the person (legacy)", asked: "Needs the person (legacy)" };

// Everything about one account, read-only. There is no way to act as the person from here.
export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await userDetail(id);
  if (!data) notFound();
  const { user, referrer, sessions, profiles, main, totals, searches, jobs, questions, questionTotal, waiting, tokens, tokenTotal, made, received } = data;
  const a = user.applicant;
  const displayName = user.username ?? "(no name yet)";

  return (
    <Page>
      <PageHead section="Users" title={displayName} description={`Joined ${when(user.createdAt)}. Read-only: there is no way to act as this person from the admin.`} />
      <div className="mt-5">
        <Breadcrumb items={[["Users", "/admin/users"], [displayName]]} />
      </div>
      <Hero
        mood={totals.kept > 0 ? "happy" : "thinking"}
        title={totals.kept > 0 ? `Kept ${totals.kept} ${totals.kept === 1 ? "job" : "jobs"}` : totals.jobs ? "Got jobs, kept none yet" : totals.searches ? "Searched, nothing delivered yet" : main?.mindId ? "Deployed, never searched" : "Still setting up"}
        subtitle={main ? `${main.label}${main.mindName ? ` (${main.mindName})` : ""} · ${main.status.replace(/_/g, " ")}` : "No headhunter yet."}
        badge={main ? <Badge tone={hhTone(main.status)}>{main.status.replace(/_/g, " ")}</Badge> : undefined}
      >
        <div className="mt-3">
          <Facts
            rows={[
              ["Email", user.email ? <span key="e">{user.email} <Badge tone={user.emailVerifiedAt ? "green" : "muted"}>{user.emailVerifiedAt ? "verified" : "not verified"}</Badge></span> : ""],
              ["Referred by", referrer ? <Link key="r" href={`/admin/users/${referrer.id}`} className="text-white underline decoration-white/20 underline-offset-2 hover:decoration-coral">{referrer.username ?? "(no name yet)"}</Link> : user.referredBy ? `code ${user.referredBy}` : ""],
              ["Extension", tokenTotal ? `connected, ${tokenTotal} ${tokenTotal === 1 ? "token" : "tokens"}` : "not connected"],
            ]}
          />
        </div>
      </Hero>

      <Tiles cols={6} className="mt-6">
        <Stat label="Searches" value={totals.searches} />
        <Stat label="Jobs" value={totals.jobs} />
        <Stat label="Kept" value={totals.kept} />
        <Stat label="Applied+" value={totals.applied} />
        <Stat label="Cognition" value={totals.cognition} />
        <Stat label="Sessions" value={sessions.total} hint={`${sessions.valid} still valid`} />
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

      <SectionTitle title={`Searches (${totals.searches})`} />
      <div className="mt-3">
        <Table
          head={["Started", "Headhunter", "Asked", "Got", "Cognition", "Took", "Ended", "Focus"]}
          empty="No searches yet."
          emptyMood="sleeping"
          rows={searches.map((s) => [
            <Link key={s.id} href={`/admin/searches/${s.id}`} className="text-white underline decoration-white/20 underline-offset-2 hover:decoration-coral">{when(s.startedAt)}</Link>,
            s.label,
            s.jobsWanted,
            s.jobsAdded ?? (s.endedAt ? 0 : "…"),
            s.cognitionUsed != null ? Math.round(Number(s.cognitionUsed)) : "",
            s.minutes ? `${s.minutes} min` : "running",
            <Badge key="e" tone={endTone(s.endReason, !s.endedAt)}>{s.endReason ?? (s.endedAt ? "ended" : "open")}</Badge>,
            <Clamp key="f" text={s.focus} className="max-w-xs" />,
          ])}
        />
        {searches.length >= MAX_ROWS && <p className="admin-text-3 mt-2 text-xs">Showing the latest {MAX_ROWS}.</p>}
      </div>

      <SectionTitle title={`Jobs (${totals.jobs})`} />
      <div className="mt-3">
        <Table
          head={["When", "Company", "Title", "Match", "Place", "Stage", "Stage changed"]}
          empty="No jobs delivered yet."
          emptyMood="sleeping"
          rows={jobs.map((j) => [when(j.createdAt), j.company, <Ext key={j.id} href={j.url}>{j.title}</Ext>, `${Math.round(j.matchScore)}%`, j.place, <Badge key="s" tone={stageTone(j.status)}>{stageLabel(j.status)}</Badge>, when(j.statusChangedAt)])}
        />
        {jobs.length >= MAX_ROWS && <p className="admin-text-3 mt-2 text-xs">Showing the latest {MAX_ROWS}.</p>}
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <div>
          <SectionTitle className="" title={`Questions (${questionTotal})`} hint={`${waiting} waiting on the person.`} />
          <div className="mt-3">
            <Table
              head={["Status", "Question", "Company", "Asked"]}
              rows={questions.map((x) => [<Badge key="s" tone={WAITING_QUESTION.has(x.status) ? "amber" : x.status === "ignored" ? "muted" : "teal"}>{QUESTION_LABEL[x.status] ?? x.status}</Badge>, <Clamp key="q" text={x.question} />, x.company ?? "", when(x.askedAt)])}
              empty="No form questions yet."
            />
          </div>
        </div>
        <div>
          <SectionTitle className="" title={`Saved answers (${user.savedAnswers.length})`} hint="Reused by the extension on later forms." />
          <div className="mt-3">
            <Table head={["Question", "Answer", "Updated"]} rows={user.savedAnswers.map((x) => [x.question, <span key="a" className="block max-w-md whitespace-pre-wrap">{x.answer}</span>, x.updatedAt.slice(0, 10)])} empty="No saved answers." />
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        <Card title={`Referrals made (${made.length})`}>
          <Table head={["Friend", "Status", "Joined"]} rows={made.map((r) => [<UserLink key={r.id} id={r.friendId} name={r.friend} />, r.status, when(r.createdAt)])} empty="Nobody yet." />
        </Card>
        <Card title="Referred by">
          <Table head={["Referrer", "Status", "Joined"]} rows={received.map((r) => [<UserLink key={r.id} id={r.referrerId} name={r.referrer} />, r.status, when(r.createdAt)])} empty="Signed up without a link." />
        </Card>
        <Card title={`Extension tokens (${tokenTotal})`} hint="Only when they were made and last used; never the token itself.">
          <Table head={["Created", "Last used"]} rows={tokens.map((t) => [when(t.createdAt), when(t.lastUsedAt) || "never"])} empty="Extension not connected." />
        </Card>
      </div>
    </Page>
  );
}
