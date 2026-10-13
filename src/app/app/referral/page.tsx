import { ExternalLink } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Ninja } from "@/components/brand";
import { appContext, balanceFor } from "@/lib/app-context";
import { HM_REFERRAL_SETUP, hmReferralUrl } from "@/lib/referrals";
import { CopyMindId } from "./copy-mind-id";
import { ReferralLink } from "./referral-link";

// Referrals are Hello Minds' programme: both sides get $5 in Cognitions. This page walks
// through setting it up there and keeps the link handy here.
export default async function ReferralPage() {
  const { user, profiles, unfinished, current } = await appContext();
  const [balance, saved] = await Promise.all([balanceFor(user, current), hmReferralUrl(user.id)]);

  return (
    <AppShell tab="referral" user={user} profiles={profiles} unfinished={unfinished} current={current} balance={balance}>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8 lg:py-10">
        <p className="text-sm text-white/45">Invite friends</p>
        <h1 className="font-display mt-1 text-3xl font-medium tracking-tight text-white">Referral</h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-white/55">
          Refer a friend and you both get <span className="text-white">$5 in Cognitions</span> from Hello Minds, once your friend has had three
          conversations with their Mind. It lands on your headhunter, so every referral is more searches.
        </p>

        <section className="mt-8 flex gap-5 rounded-3xl bg-surface p-6 md:p-8">
          <Ninja mood="love" className="hidden size-14 shrink-0 sm:block" />
          <ol className="min-w-0 flex-1 space-y-6">
            <li>
              <p className="font-display font-medium text-white">1. Make your headhunter the default Mind</p>
              <p className="mt-1 text-sm text-white/55">On Hello Minds, under Referral, paste this Mind ID and confirm. Rewards go to the default Mind.</p>
              <div className="mt-3">
                <CopyMindId id={current.mindId ?? ""} name={current.mindName ?? current.label} />
              </div>
            </li>
            <li>
              <p className="font-display font-medium text-white">2. Create your link there</p>
              <p className="mt-1 text-sm text-white/55">Pick any tag (your name works) and press Generate link.</p>
              <a href={HM_REFERRAL_SETUP} target="_blank" rel="noopener noreferrer" className="btn btn-accent mt-3">
                Open Hello Minds referral <ExternalLink className="size-4" aria-hidden />
              </a>
            </li>
            <li>
              <p className="font-display font-medium text-white">3. Paste it here, share it anywhere</p>
              <p className="mt-1 mb-3 text-sm text-white/55">
                Your friend creates their Mind through that link, then signs in at careerninja.app with the same account.
              </p>
              <ReferralLink saved={saved} />
            </li>
          </ol>
        </section>
      </main>
    </AppShell>
  );
}
