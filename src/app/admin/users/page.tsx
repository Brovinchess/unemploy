import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { APPLIED_PLUS, KEPT, WAITING_QUESTION, daysAgo, directory, includes, sessionCreatedAt, sortParams, sortRows, sum, when, queue } from "@/lib/admin";
import { Badge, Cap, Check, ClearLink, FilterForm, Page, PageHead, SortLink, Table, TextInput, UserLink, hhTone } from "../ui";

const BASE = "/admin/users";
const MAX_ROWS = 500;

export default async function Users({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const { key, dir } = sortParams(q, "joined");
  const [d, fullUsers, searches, jobs, tokens, sessions, questions] = await queue([
    () => directory(),
    () => db.query.users.findMany({ columns: { id: true, savedAnswers: true }, orderBy: desc(schema.users.createdAt) }),
    () => db.query.searches.findMany({ columns: { profileId: true, startedAt: true, cognitionUsed: true } }),
    () => db.query.jobs.findMany({ columns: { profileId: true, status: true } }),
    () => db.query.extensionTokens.findMany({ columns: { userId: true, lastUsedAt: true, createdAt: true } }),
    () => db.query.sessions.findMany({ columns: { userId: true, expiresAt: true } }),
    () => db.query.questions.findMany({ columns: { userId: true, status: true } }),
  ]);
  const { users, profiles, profileIdsOf } = d;
  const answers = new Map(fullUsers.map((u) => [u.id, u.savedAnswers?.length ?? 0]));
  const codeOwner = new Map(users.filter((u) => u.referralCode).map((u) => [u.referralCode!, u]));
  const latest = (ds: (Date | null)[]) => ds.filter((x): x is Date => !!x).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  let rows = users.map((u) => {
    const ids = profileIdsOf(u.id);
    const mine = profiles.filter((p) => ids.has(p.id));
    const s = searches.filter((x) => ids.has(x.profileId));
    const j = jobs.filter((x) => ids.has(x.profileId));
    const hh = mine.find((p) => p.status === "hunting" || p.status === "paused") ?? mine[0];
    const tok = tokens.filter((t) => t.userId === u.id);
    const lastSearch = latest(s.map((x) => x.startedAt));
    // Sessions only store their expiry; the newest one tells us when the person last signed in.
    const lastSession = latest(sessions.filter((x) => x.userId === u.id).map((x) => sessionCreatedAt(x.expiresAt)));
    const referrer = u.referredBy ? codeOwner.get(u.referredBy) : undefined;
    return {
      ...u,
      name: u.username ?? "(no name yet)",
      deployed: mine.some((p) => p.mindId),
      hhStatus: hh ? hh.status.replace(/_/g, " ") : "",
      hhRaw: hh?.status ?? "",
      searches: s.length,
      jobs: j.length,
      kept: j.filter((x) => KEPT.has(x.status)).length,
      applied: j.filter((x) => APPLIED_PLUS.has(x.status)).length,
      cognition: Math.round(sum(s, (x) => x.cognitionUsed)),
      lastSearch,
      lastSeen: latest([lastSession, lastSearch]),
      extension: tok.length > 0,
      extensionUsed: latest(tok.map((t) => t.lastUsedAt ?? t.createdAt)),
      referrer: referrer ? (referrer.username ?? "(no name yet)") : u.referredBy ? `code ${u.referredBy}` : "",
      referrerId: referrer?.id,
      waiting: questions.filter((x) => x.userId === u.id && WAITING_QUESTION.has(x.status)).length,
      answers: answers.get(u.id) ?? 0,
    };
  });

  if (q.q) rows = rows.filter((r) => includes(r.username, q.q!) || includes(r.email, q.q!));
  if (q.deployed) rows = rows.filter((r) => r.deployed);
  if (q.active) {
    const since = daysAgo(Math.max(1, Number(q.active) || 7));
    rows = rows.filter((r) => r.lastSearch && r.lastSearch >= since);
  }
  if (q.idle) rows = rows.filter((r) => r.deployed && r.searches === 0);
  if (q.nokeep) rows = rows.filter((r) => r.searches > 0 && r.kept === 0);
  rows = sortRows(rows, key, dir, {
    name: (r) => r.username,
    joined: (r) => r.createdAt,
    email: (r) => r.email,
    status: (r) => r.hhStatus,
    searches: (r) => r.searches,
    jobs: (r) => r.jobs,
    kept: (r) => r.kept,
    applied: (r) => r.applied,
    cognition: (r) => r.cognition,
    lastSearch: (r) => r.lastSearch,
    lastSeen: (r) => r.lastSeen,
    extension: (r) => r.extensionUsed,
    referrer: (r) => r.referrer,
    waiting: (r) => r.waiting,
    answers: (r) => r.answers,
  });
  const col = (k: string, label: string) => <SortLink k={k} label={label} base={BASE} q={q} sort={key} dir={dir} />;
  const filtered = !!(q.q || q.deployed || q.active || q.idle || q.nokeep);

  return (
    <Page>
      <PageHead
        section="Users"
        title={`${rows.length} accounts`}
        description={`${users.length} in total. ${users.filter((u) => profiles.some((p) => p.userId === u.id && p.mindId)).length} deployed a headhunter. ${users.filter((u) => !u.username).length} never finished the name step.`}
        controls={
          <FilterForm q={q}>
            <TextInput name="q" value={q.q} placeholder="Username or email" />
            <TextInput name="active" value={q.active} placeholder="Searched in last N days" size={20} />
            <Check name="deployed" checked={!!q.deployed} label="Deployed" />
            <Check name="idle" checked={!!q.idle} label="Deployed, never searched" />
            <Check name="nokeep" checked={!!q.nokeep} label="Searched, kept nothing" />
            {filtered && <ClearLink href={BASE} />}
          </FilterForm>
        }
      />
      <div className="mt-6">
        <Table
          head={[
            col("name", "User"), col("joined", "Joined"), col("email", "Email"), col("status", "Headhunter"), col("searches", "Searches"), col("jobs", "Jobs"), col("kept", "Kept"), col("applied", "Applied+"),
            col("cognition", "Cognition"), col("lastSearch", "Last search"), col("lastSeen", "Last seen"), col("extension", "Extension"), col("referrer", "Referred by"), col("waiting", "Questions waiting"), col("answers", "Saved answers"),
          ]}
          empty="No accounts match these filters."
          rows={rows.slice(0, MAX_ROWS).map((r) => [
            <UserLink key={r.id} id={r.id} name={r.name} />,
            when(r.createdAt).slice(0, 10),
            r.email ? (
              <span key="e" title={r.email}>
                {r.email.length > 28 ? `${r.email.slice(0, 26)}…` : r.email} <span className={r.emailVerifiedAt ? "text-emerald-300" : "text-white/35"}>{r.emailVerifiedAt ? "✓" : "unverified"}</span>
              </span>
            ) : (
              ""
            ),
            r.hhStatus ? <Badge key="h" tone={hhTone(r.hhRaw)}>{r.hhStatus}</Badge> : <span key="n" className="text-white/30">none</span>,
            r.searches,
            r.jobs,
            r.kept,
            r.applied,
            r.cognition,
            when(r.lastSearch),
            when(r.lastSeen),
            r.extension ? `yes${r.extensionUsed ? `, ${when(r.extensionUsed).slice(0, 10)}` : ""}` : <span key="x" className="text-white/30">no</span>,
            r.referrerId ? <UserLink key="r" id={r.referrerId} name={r.referrer} /> : r.referrer,
            r.waiting ? <Badge key="w" tone="amber">{r.waiting}</Badge> : <span key="w" className="text-white/25">0</span>,
            r.answers || <span key="a" className="text-white/25">0</span>,
          ])}
        />
        <Cap shown={MAX_ROWS} total={rows.length} />
      </div>
    </Page>
  );
}
