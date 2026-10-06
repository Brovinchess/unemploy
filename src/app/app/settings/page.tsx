import { and, count, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { AppShell } from "@/components/app-shell";
import { ExtensionSetup } from "@/components/extension-ui";
import { appContext, balanceFor } from "@/lib/app-context";
import { detailsComplete } from "@/lib/extension";
import { DeleteAccount } from "./delete-account";
import { EmailUpdates } from "./email-updates";

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8 grid gap-6 rounded-3xl bg-surface p-6 md:grid-cols-[220px_1fr] md:p-8">
      <h2 className="font-display font-medium text-white">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

// Set-up-once things: the Chrome extension, email, account. Each headhunter's own settings
// live on its page; details about the person live on the You page.
export default async function Settings() {
  const { user, profiles, unfinished, current } = await appContext();
  const balance = await balanceFor(user, current);
  const [{ n: toApply }] = await db
    .select({ n: count() })
    .from(schema.jobs)
    .where(and(inArray(schema.jobs.profileId, profiles.map((p) => p.id)), eq(schema.jobs.status, "saved")));

  return (
    <AppShell tab="settings" user={user} profiles={profiles} unfinished={unfinished} current={current} balance={balance}>
      <main className="w-full max-w-5xl flex-1 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <p className="text-sm text-white/45">Your account</p>
        <h1 className="font-display mt-1 text-3xl font-medium tracking-tight text-white">Settings</h1>
        <p className="mt-2 text-white/55">To change what a headhunter looks for, its resume or cognition, open it from the sidebar.</p>

        <div className="mt-8 space-y-4">
          <Section title="Chrome extension" id="extension">
            <p className="mb-5 text-sm text-white/55">
              Opens each job you swiped right on, fills the form with your details, resume, cover letter and answers, and waits
              for you to press Submit. Works on Greenhouse, Lever and Ashby, in Chrome, Edge and Brave on a computer.
            </p>
            <ExtensionSetup detailsComplete={detailsComplete(user.applicant)} toApply={toApply} />
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
