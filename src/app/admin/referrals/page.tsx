import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { when } from "@/lib/admin";
import { Stat, Table } from "../ui";

export default async function Referrals() {
  const [refs, users, profiles, searches] = await Promise.all([
    db.query.referrals.findMany({ orderBy: desc(schema.referrals.createdAt) }),
    db.query.users.findMany({ columns: { id: true, username: true, referralCode: true } }),
    db.query.profiles.findMany({ columns: { id: true, userId: true, mindId: true } }),
    db.query.searches.findMany({ columns: { profileId: true, cognitionUsed: true } }),
  ]);
  const name = new Map(users.map((u) => [u.id, u.username ?? "?"]));
  const spent = (userId: string) => {
    const ids = new Set(profiles.filter((p) => p.userId === userId).map((p) => p.id));
    return Math.round(searches.filter((s) => ids.has(s.profileId)).reduce((a, s) => a + Number(s.cognitionUsed ?? 0), 0));
  };
  const byReferrer = new Map<string, number>();
  for (const r of refs) byReferrer.set(r.referrerId, (byReferrer.get(r.referrerId) ?? 0) + 1);
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <p className="text-sm text-white/45">Referrals</p>
      <h1 className="font-display mt-1 text-3xl font-medium">{refs.length} friends joined through a link</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Referrers" value={byReferrer.size} />
        <Stat label="Friends who deployed" value={refs.filter((r) => profiles.some((p) => p.userId === r.referredId && p.mindId)).length} />
        <Stat label="Cognition by referred friends" value={refs.reduce((a, r) => a + spent(r.referredId), 0)} />
      </div>
      <div className="mt-6">
        <Table head={["Joined", "Friend", "Referred by", "Deployed", "Cognition spent"]} rows={refs.map((r) => [when(r.createdAt), name.get(r.referredId) ?? "?", name.get(r.referrerId) ?? "?", profiles.some((p) => p.userId === r.referredId && p.mindId) ? "yes" : "no", spent(r.referredId)])} />
      </div>
      <h2 className="font-display mt-10 text-xl font-medium">Top referrers</h2>
      <div className="mt-3">
        <Table head={["User", "Friends", "Link"]} rows={[...byReferrer.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => [name.get(id) ?? "?", n, `careerninja.app/r/${users.find((u) => u.id === id)?.referralCode ?? ""}`])} />
      </div>
    </main>
  );
}
