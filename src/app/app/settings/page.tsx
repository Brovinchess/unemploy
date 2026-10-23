import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { AppShell } from "@/components/app-shell";
import { ExtensionSetup } from "@/components/extension-ui";
import { appContext, balanceFor } from "@/lib/app-context";
import { detailsComplete, isSupported } from "@/lib/extension";
import { DeleteAccount } from "./delete-account";
import { CoachSwitch } from "./coach-switch";
import { EmailUpdates } from "./email-updates";
import { MorningSearch } from "@/components/morning-search";
import { costModel } from "@/lib/cost";

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8 grid gap-6 rounded-3xl bg-surface p-6 md:grid-cols-[220px_1fr] md:p-8">
      <h2 className="font-display font-medium text-white">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

// Set-up-once things: the Chrome extension, email, account. The headhunter's own settings
// live on its page; details about the person live on the You page.
export default async function Settings() {
  const { user, profiles, unfinished, current } = await appContext();
  const [balance, cost, applyUrls] = await Promise.all([
    balanceFor(user, current),
    costModel(current.id),
    // Kept jobs with a written application; the extension can fill only some of their sites.
    db
      .select({ url: schema.jobs.url })
      .from(schema.jobs)
      .innerJoin(schema.packs, eq(schema.packs.jobId, schema.jobs.id))
      .where(and(inArray(schema.jobs.profileId, profiles.map((p) => p.id)), eq(schema.jobs.status, "saved"))),
  ]);
  const ready = applyUrls.filter((j) => isSupported(j.url)).length;
  const other = applyUrls.length - ready;

  return (
    <AppShell tab="settings" user={user} profiles={profiles} unfinished={unfinished} current={current} balance={balance}>
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <p className="text-sm text-white/45">Your account</p>
        <h1 className="font-display mt-1 text-3xl font-medium tracking-tight text-white">Settings</h1>
        <p className="mt-2 text-white/55">To change what your headhunter looks for or its resume, open its page.</p>

        <div className="mt-8 space-y-4">
          <Section title="Chrome extension" id="extension">
            <p className="mb-5 text-sm text-white/55">
              Fills in job application forms for you, with your details, resume, cover letter and answers. You check each one and press Submit.
            </p>
            <ExtensionSetup detailsComplete={detailsComplete(user.applicant)} toApply={ready} other={other} />
          </Section>

          <Section title="Morning searches" id="morning">
            <MorningSearch
              compact
              profileId={current.id}
              jobs={current.autoSearchJobs}
              days={current.autoSearchDays}
              defaultJobs={current.preferences?.jobsPerDay ?? 5}
              perJob={cost.perJob}
              extraPlaces={current.preferences?.extraPlaces?.length ?? 0}
              balance={balance}
              email={user.emailVerifiedAt && user.emailOnSearchDone ? user.email : null}
              disabled={current.status === "paused" ? "Resume this headhunter to turn this on." : current.status !== "hunting" ? "Finish setting up your headhunter first." : balance != null && balance <= 0 ? "Top up to turn this on." : undefined}
            />
            {profiles.length > 1 && <p className="mt-4 text-xs text-white/35">This is for {current.label}. Each headhunter has its own, on its page.</p>}
          </Section>

          <Section title="Search coach" id="coach">
            <CoachSwitch on={user.coachReminders} />
          </Section>

          <Section title="Email updates" id="email">
            <EmailUpdates email={user.emailVerifiedAt ? user.email : null} on={user.emailOnSearchDone} />
          </Section>

          <Section title="Account">
            <p className="text-white/60">Signed in with Hello Minds as {user.username}.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <form action="/auth/logout" method="post">
                <button className="btn btn-ghost">Sign out</button>
              </form>
              <DeleteAccount />
            </div>
          </Section>
        </div>
      </main>
    </AppShell>
  );
}
