import { and, count, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { AppShell } from "@/components/app-shell";
import { ExtensionSetup } from "@/components/extension-ui";
import { appContext, balanceFor } from "@/lib/app-context";
import { detailsComplete } from "@/lib/extension";

// Install, connect and use the Chrome extension.
export default async function ExtensionPage() {
  const { user, profiles, unfinished, current } = await appContext();
  const balance = await balanceFor(user, current);
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.jobs)
    .where(and(inArray(schema.jobs.profileId, profiles.map((p) => p.id)), eq(schema.jobs.status, "saved")));

  return (
    <AppShell tab="extension" user={user} profiles={profiles} unfinished={unfinished} current={current} balance={balance}>
      <main className="w-full max-w-3xl flex-1 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <p className="text-sm text-white/45">Chrome extension</p>
        <h1 className="font-display mt-1 text-3xl font-medium tracking-tight text-white">Apply to all, in one go</h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-white/60">
          The Career Ninja extension opens each job you swiped right on, fills in the form with your details, resume, cover
          letter and answers, and waits for you to check it and press Submit. It works on Greenhouse, Lever and Ashby
          application pages, in Chrome, Edge and Brave on a computer.
        </p>
        <div className="mt-8">
          <ExtensionSetup detailsComplete={detailsComplete(user.applicant)} toApply={n} />
        </div>
      </main>
    </AppShell>
  );
}
