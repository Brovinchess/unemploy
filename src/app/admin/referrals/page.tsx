import { notFound } from "next/navigation";
import { desc, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { isAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/session";
import { markRewarded } from "./actions";

// Referrals that have earned a reward: who to top up, and by how much. Top up on Hello Minds, then mark it.
export default async function AdminReferrals() {
  const user = await requireUser();
  if (!isAdmin(user.username)) notFound();
  const rows = await db.query.referrals.findMany({ where: inArray(schema.referrals.status, ["qualified", "rewarded"]), orderBy: desc(schema.referrals.qualifiedAt), limit: 200 });
  const ids = [...new Set(rows.flatMap((r) => [r.referrerId, r.referredId]))];
  const users = ids.length ? await db.query.users.findMany({ where: inArray(schema.users.id, ids), columns: { id: true, username: true } }) : [];
  const profiles = ids.length ? await db.query.profiles.findMany({ where: inArray(schema.profiles.userId, ids), columns: { userId: true, mindName: true, label: true } }) : [];
  const name = (id: string) => users.find((u) => u.id === id)?.username ?? id.slice(0, 8);
  const minds = (id: string) => profiles.filter((p) => p.userId === id).map((p) => `${p.mindName ?? p.label}`).join(", ") || "no headhunter yet";
  const owed = rows.filter((r) => r.status === "qualified");

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 text-white">
      <h1 className="font-display text-2xl font-medium">Referral rewards</h1>
      <p className="mt-1 text-sm text-white/55">
        {owed.length} to top up ({owed.reduce((a, r) => a + r.reward, 0)} cognition). Top up the referrer&rsquo;s headhunter on Hello Minds, then mark it done.
      </p>
      <table className="mt-6 w-full text-sm">
        <thead className="text-left text-white/45">
          <tr>
            <th className="py-2">Referrer</th>
            <th>Their headhunters</th>
            <th>Friend</th>
            <th>Reward</th>
            <th>Qualified</th>
            <th></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {rows.map((r) => (
            <tr key={r.id} className={r.status === "rewarded" ? "text-white/40" : ""}>
              <td className="py-2.5">{name(r.referrerId)}</td>
              <td className="font-mono text-xs">{minds(r.referrerId)}</td>
              <td>{name(r.referredId)}</td>
              <td>{r.reward}</td>
              <td>{r.qualifiedAt?.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td>
              <td className="text-right">
                {r.status === "qualified" ? (
                  <form action={markRewarded.bind(null, r.id)}>
                    <button className="btn btn-primary btn-sm">Mark topped up</button>
                  </form>
                ) : (
                  <span className="text-xs">done {r.rewardedAt?.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-white/45">
                Nothing yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
