import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { AppShell } from "@/components/app-shell";
import { Ninja } from "@/components/brand";
import { appContext, balanceFor } from "@/lib/app-context";
import { REFERRAL_REWARD, referralCodeFor, referralLink, referralStats } from "@/lib/referrals";
import { InviteFriends } from "./invite-friends";

const STATUS: Record<string, string> = { joined: "Joined, setting up", qualified: "Searching · reward on its way", rewarded: "Searching · reward received" };

// Share a link, see who joined through it, and what each one earned.
export default async function ReferralPage() {
  const { user, profiles, unfinished, current } = await appContext();
  const [balance, code, stats, rows] = await Promise.all([
    balanceFor(user, current),
    referralCodeFor(user.id),
    referralStats(user.id),
    db.query.referrals.findMany({ where: eq(schema.referrals.referrerId, user.id), orderBy: desc(schema.referrals.createdAt), limit: 100 }),
  ]);
  const friends = rows.length
    ? await db.query.users.findMany({ where: inArray(schema.users.id, rows.map((r) => r.referredId)), columns: { id: true, username: true } })
    : [];
  const name = (id: string) => friends.find((f) => f.id === id)?.username ?? "A friend";

  return (
    <AppShell tab="referral" user={user} profiles={profiles} unfinished={unfinished} current={current} balance={balance}>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8 lg:py-10">
        <p className="text-sm text-white/45">Invite friends</p>
        <h1 className="font-display mt-1 text-3xl font-medium tracking-tight text-white">Referral</h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-white/55">
          Each friend who signs up through your link and gets their first headhunter running earns you {REFERRAL_REWARD} cognition.
        </p>

        <section className="mt-8 rounded-3xl bg-surface p-6 md:p-8">
          <InviteFriends link={referralLink(code)} reward={REFERRAL_REWARD} stats={stats} />
        </section>

        <section className="mt-6 rounded-3xl bg-surface p-6 md:p-8">
          <h2 className="font-display font-medium text-white">
            Friends <span className="text-white/35">{rows.length || ""}</span>
          </h2>
          {rows.length === 0 ? (
            <div className="mt-4 flex items-center gap-4 text-sm text-white/50">
              <Ninja mood="happy" className="size-12 shrink-0" />
              No one yet. Send your link to someone who is job hunting.
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-white/[0.06]">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div>
                    <p className="text-white">{name(r.referredId)}</p>
                    <p className="text-white/45">{STATUS[r.status] ?? r.status}</p>
                  </div>
                  <span className={r.status === "joined" ? "text-white/35" : r.status === "qualified" ? "text-coral" : "text-white/70"}>
                    {r.status === "joined" ? `${REFERRAL_REWARD} when they start` : `${r.reward} cognition`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </AppShell>
  );
}
