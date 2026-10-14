import { AppShell } from "@/components/app-shell";
import { Ninja } from "@/components/brand";
import { appContext, balanceFor } from "@/lib/app-context";
import { mindsConfig } from "@/lib/minds/config";
import { referralCodeFor, referralStats } from "@/lib/referrals";
import { CopyLink } from "./copy-link";

// Your own link, and what the friends who used it have done. No rewards yet: this is the
// record they'd be paid from later.
export default async function ReferralPage() {
  const { user, profiles, unfinished, current } = await appContext();
  const [balance, code, stats] = await Promise.all([balanceFor(user, current), referralCodeFor(user.id), referralStats(user.id)]);
  const url = `${mindsConfig.appUrl}/r/${code}`;

  return (
    <AppShell tab="referral" user={user} profiles={profiles} unfinished={unfinished} current={current} balance={balance}>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8 lg:py-10">
        <p className="text-sm text-white/45">Invite friends</p>
        <h1 className="font-display mt-1 text-3xl font-medium tracking-tight text-white">Referral</h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-white/55">
          Share your link. Friends who sign up through it show up here, with what their headhunter has done since.
        </p>

        <section className="mt-8 flex gap-5 rounded-3xl bg-surface p-6 md:p-8">
          <Ninja mood="love" className="float hidden size-14 shrink-0 sm:block" />
          <div className="min-w-0 flex-1">
            <p className="font-display font-medium text-white">Your link</p>
            <p className="mt-1 mb-3 text-sm text-white/55">Works anywhere: chat, email, a post. It stays yours.</p>
            <CopyLink url={url} />
          </div>
        </section>

        <section className="mt-6 rounded-3xl bg-surface p-6 md:p-8">
          <div className="flex items-baseline justify-between gap-4">
            <p className="font-display font-medium text-white">Friends who joined</p>
            <p className="text-sm text-white/45">
              {stats.friends.length} {stats.friends.length === 1 ? "friend" : "friends"} · {stats.cognition} cognition spent
            </p>
          </div>
          {stats.friends.length === 0 ? (
            <p className="mt-4 text-sm text-white/45">Nobody yet. The first friend who signs up through your link appears here.</p>
          ) : (
            <ul className="mt-4 divide-y divide-white/[0.06]">
              {stats.friends.map((f, i) => (
                <li key={i} className="flex items-center gap-4 py-3 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium text-white">{f.username ?? "New member"}</span>
                  <span className="tabular-nums text-white">{f.cognition} cognition</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </AppShell>
  );
}
