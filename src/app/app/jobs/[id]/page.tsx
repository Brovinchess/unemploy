import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { JobDetail } from "@/components/job-detail";
import { appContext, balanceFor } from "@/lib/app-context";
import { ownedJob } from "@/lib/owned";
import { requireUser } from "@/lib/session";

// One job in full: the application pack to copy, and Apply / Save / Skip.
export default async function JobPage({ params }: PageProps<"/app/jobs/[id]">) {
  const { id } = await params;
  const { job } = await ownedJob(await requireUser(), id);
  const { user, profiles, unfinished, current } = await appContext(job.profileId);
  const balance = await balanceFor(user, current);
  const back = `/app?profile=${job.profileId}`;

  return (
    <AppShell tab="shortlist" user={user} profiles={profiles} unfinished={unfinished} current={current} balance={balance}>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8 lg:py-10">
        <Link href={back} className="mb-5 inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white">
          <ArrowLeft className="size-4" aria-hidden /> Back
        </Link>
        <JobDetail job={job} doneHref={back} />
      </main>
    </AppShell>
  );
}
