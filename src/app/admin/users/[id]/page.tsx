import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { APPLIED_PLUS, KEPT, WAITING_QUESTION, daysAgo, maskEmail, maskPhone, mins, stageLabel, sum, when } from "@/lib/admin";
import { summarizePreferences } from "@/lib/preferences";
import { Card, Ext, Facts, PageHead, Stat, Table } from "../../ui";

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

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <PageHead section="Users" title={user.username ?? "(no name yet)"}>
        <p className="mt-2 text-sm text-white/55">
          <Link href="/admin/users" className="underline underline-offset-2 hover:text-white">All users</Link> · joined {when(user.createdAt)}
          {referrer && (
            <>
              {" · referred by "}
              <Link href={`/admin/users/${referrer.id}`} className="underline underline-offset-2 hover:text-white">{referrer.username ?? "(no name yet)"}</Link>
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-white/40">Read-only. Impersonation is not available: there is no way to act as this person from the admin.</p>
      </PageHead>

      <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Searches" value={searches.length} />
        <Stat label="Jobs" value={jobs.length} />
        <Stat label="Kept" value={jobs.filter((j) => KEPT.has(j.status)).length} />
        <Stat label="Applied+" value={jobs.filter((j) => APPLIED_PLUS.has(j.status)).length} />
        <Stat label="Cognition" value={Math.round(sum(searches, (s) => s.cognitionUsed))} />
        <Stat label="Sessions" value={sessions.length} hint={`${sessions.filter((s) => s.expiresAt > now).length} still valid`} />
      </div>

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
            <p className="text-sm text-white/40">Not filled in yet.</p>
          )}
        </Card>
      </div>

      <h2 className="font-display mt-10 text-xl font-medium">Headhunter{profiles.length > 1 ? `s (${profiles.length})` : ""}</h2>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        {profiles.map((p) => (
          <Card key={p.id} title={`${p.label}${p.mindName ? ` · ${p.mindName}` : ""}`} hint={p.id === main?.id && profiles.length > 1 ? "Main headhunter" : undefined}>
            <Facts
              rows={[
                ["Status", p.status.replace(/_/g, " ")],
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
        {!profiles.length && <p className="text-sm text-white/40">No headhunter yet.</p>}
      </div>

      <h2 className="font-display mt-10 text-xl font-medium">Searches ({searches.length})</h2>
      <div className="mt-3">
        <Table
          head={["Started", "Headhunter", "Asked", "Got", "Cognition", "Took", "Ended", "Focus"]}
          rows={searches.map((s) => {
            const m = mins(s.startedAt, s.endedAt);
            return [
              <Link key={s.id} href={`/admin/searches/${s.id}`} className="underline decoration-white/20 underline-offset-2 hover:text-white">{when(s.startedAt)}</Link>,
              label.get(s.profileId) ?? "?",
              s.jobsWanted,
              s.jobsAdded ?? (s.endedAt ? 0 : "…"),
              s.cognitionUsed != null ? Math.round(Number(s.cognitionUsed)) : "",
              m ? `${m} min` : "running",
              s.endReason ?? (s.endedAt ? "" : "open"),
              s.focus ?? "",
            ];
          })}
        />
        {searches.length >= MAX_ROWS && <p className="mt-2 text-xs text-white/40">Showing the latest {MAX_ROWS}.</p>}
      </div>

      <h2 className="font-display mt-10 text-xl font-medium">Jobs ({jobs.length})</h2>
      <div className="mt-3">
        <Table
          head={["When", "Company", "Title", "Match", "Place", "Stage", "Stage changed"]}
          rows={jobs.map((j) => [when(j.createdAt), j.company, <Ext key={j.id} href={j.url}>{j.title}</Ext>, `${Math.round(j.matchScore)}%`, [j.city, j.country].filter(Boolean).join(", "), stageLabel(j.status), when(j.statusChangedAt)])}
        />
        {jobs.length >= MAX_ROWS && <p className="mt-2 text-xs text-white/40">Showing the latest {MAX_ROWS}.</p>}
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-xl font-medium">Questions ({questions.length})</h2>
          <p className="mt-1 text-sm text-white/50">{waiting.length} waiting on the person.</p>
          <div className="mt-3">
            <Table head={["Status", "Question", "Company", "Asked"]} rows={questions.map((x) => [QUESTION_LABEL[x.status] ?? x.status, x.question, x.company ?? "", when(x.askedAt ?? x.createdAt)])} empty="No form questions yet." />
          </div>
        </div>
        <div>
          <h2 className="font-display text-xl font-medium">Saved answers ({user.savedAnswers?.length ?? 0})</h2>
          <p className="mt-1 text-sm text-white/50">Reused by the extension on later forms.</p>
          <div className="mt-3">
            <Table head={["Question", "Answer", "Updated"]} rows={(user.savedAnswers ?? []).map((x) => [x.question, <span key="a" className="block max-w-md whitespace-pre-wrap">{x.answer}</span>, x.updatedAt.slice(0, 10)])} empty="No saved answers." />
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        <Card title={`Referrals made (${made.length})`}>
          <Table head={["Friend", "Status", "Joined"]} rows={made.map((r) => [<Link key={r.id} href={`/admin/users/${r.referredId}`} className="underline decoration-white/20 underline-offset-2">{name.get(r.referredId) ?? "?"}</Link>, r.status, when(r.createdAt)])} empty="Nobody yet." />
        </Card>
        <Card title="Referred by">
          <Table head={["Referrer", "Status", "Joined"]} rows={received.map((r) => [<Link key={r.id} href={`/admin/users/${r.referrerId}`} className="underline decoration-white/20 underline-offset-2">{name.get(r.referrerId) ?? "?"}</Link>, r.status, when(r.createdAt)])} empty="Signed up without a link." />
        </Card>
        <Card title={`Extension tokens (${tokens.length})`} hint="Only when they were made and last used; never the token itself.">
          <Table head={["Created", "Last used"]} rows={tokens.map((t) => [when(t.createdAt), when(t.lastUsedAt) || "never"])} empty="Extension not connected." />
        </Card>
      </div>
    </main>
  );
}
