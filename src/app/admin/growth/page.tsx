import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { dayKeys, daysAgo, directory, perDay, pct, sum, tally, when } from "@/lib/admin";
import { BarChart, Card, Counts, DaysPicker, PageHead, Stat, Table, UserLink, daysParam } from "../ui";

const BASE = "/admin/growth";

// Where people come from: signups, friend referrals, and the pre-launch waitlist.
export default async function Growth({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const days = daysParam(q, 30);
  const since = daysAgo(days);
  const [d, refs, searches, waitlist] = await Promise.all([
    directory(),
    db.query.referrals.findMany({ orderBy: desc(schema.referrals.createdAt) }),
    db.query.searches.findMany({ columns: { profileId: true, cognitionUsed: true } }),
    db.query.waitlist.findMany({ orderBy: desc(schema.waitlist.createdAt) }),
  ]);
  const { users, profiles, nameOf, profileIdsOf } = d;

  // Signups per day, referred (came in with a code) vs organic.
  const keys = dayKeys(days);
  const recent = users.filter((u) => u.createdAt >= since);
  const series = [
    { label: "Organic", color: "text-sky-400", values: perDay(recent.filter((u) => !u.referredBy), keys, (u) => u.createdAt) },
    { label: "Referred", color: "text-coral", values: perDay(recent.filter((u) => u.referredBy), keys, (u) => u.createdAt) },
  ];

  const deployedUser = (uid: string) => profiles.some((p) => p.userId === uid && p.mindId);
  const spent = (uid: string) => {
    const ids = profileIdsOf(uid);
    return Math.round(sum(searches.filter((s) => ids.has(s.profileId)), (s) => s.cognitionUsed));
  };
  const byReferrer = tally(refs, (r) => r.referrerId);
  const codeOf = new Map(users.map((u) => [u.id, u.referralCode]));

  // Waitlist to signup: same email, lower-cased.
  const signedUp = new Map(users.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u]));
  const converted = waitlist.filter((w) => signedUp.has(w.email.toLowerCase()));

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <PageHead section="Growth" title="Signups, referrals and the waitlist">
        <div className="mt-2"><DaysPicker days={days} base={BASE} q={q} /></div>
      </PageHead>

      <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label={`Signups, ${days}d`} value={recent.length} hint={`${recent.filter((u) => u.referredBy).length} referred`} />
        <Stat label="Accounts, all time" value={users.length} />
        <Stat label="Friends via links" value={refs.length} hint={`${byReferrer.length} referrers`} />
        <Stat label="Friends who deployed" value={refs.filter((r) => deployedUser(r.referredId)).length} />
        <Stat label="Waitlist" value={waitlist.length} hint={`${waitlist.filter((w) => w.verifiedAt).length} verified`} />
        <Stat label="Waitlist → signed up" value={converted.length} hint={pct(converted.length, waitlist.length)} />
      </div>

      <div className="mt-6">
        <Card>
          <BarChart title="Signups per day" keys={keys} series={series} height={170} />
        </Card>
      </div>

      <h2 className="font-display mt-10 text-xl font-medium">Referrals ({refs.length})</h2>
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table
            head={["Joined", "Friend", "Referred by", "Status", "Deployed", "Cognition spent"]}
            rows={refs.map((r) => [when(r.createdAt), <UserLink key="f" id={r.referredId} name={nameOf(r.referredId)} />, <UserLink key="r" id={r.referrerId} name={nameOf(r.referrerId)} />, r.status, deployedUser(r.referredId) ? "yes" : "no", spent(r.referredId)])}
            empty="Nobody has joined through a link yet."
          />
        </div>
        <Card title="Top referrers">
          <Table head={["User", "Friends", "Link"]} rows={byReferrer.map(([id, n]) => [<UserLink key={id} id={id} name={nameOf(id)} />, n, `careerninja.app/r/${codeOf.get(id) ?? ""}`])} empty="No referrers yet." />
        </Card>
      </div>

      <h2 className="font-display mt-10 text-xl font-medium">Waitlist ({waitlist.length})</h2>
      <p className="mt-1 text-sm text-white/50">
        {waitlist.filter((w) => w.verifiedAt).length} verified their email. {converted.length} have since signed up with the same email.
      </p>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <Counts title="Country" total={waitlist.length} rows={tally(waitlist, (w) => w.country ?? "unknown")} />
        <Counts title="Role area" total={waitlist.length} rows={tally(waitlist, (w) => w.roleArea ?? "unknown")} />
        <Card title="Converted" hint="Waitlist emails that later became accounts.">
          <Table
            head={["Waitlisted", "Signed up", "User"]}
            rows={converted.map((w) => {
              const u = signedUp.get(w.email.toLowerCase())!;
              return [when(w.createdAt).slice(0, 10), when(u.createdAt).slice(0, 10), <UserLink key={u.id} id={u.id} name={nameOf(u.id)} />];
            })}
            empty="None yet."
          />
        </Card>
      </div>
      <div className="mt-4">
        <Table
          head={["Joined", "Name", "Email", "Country", "Role area", "Verified", "Came with code", "Signed up"]}
          rows={waitlist.map((w) => [when(w.createdAt), w.name ?? "", w.email, w.country ?? "", w.roleArea ?? "", w.verifiedAt ? "yes" : "no", w.referredBy ?? "", signedUp.has(w.email.toLowerCase()) ? "yes" : ""])}
        />
      </div>
    </main>
  );
}
