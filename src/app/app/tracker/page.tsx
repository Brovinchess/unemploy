import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { JobStatus } from "@/db/schema";
import { AppShell } from "@/components/app-shell";
import { ApplyAllButton } from "@/components/extension-ui";
import { detailsComplete } from "@/lib/extension";
import { Ninja } from "@/components/brand";
import { appContext, balanceFor } from "@/lib/app-context";
import { MoveJob } from "./move-job";
import { CompanyLogo } from "@/components/company-logo";

const COLUMNS: { status: JobStatus; label: string }[] = [
  { status: "saved", label: "To apply" },
  { status: "applied", label: "Applied" },
  { status: "heard_back", label: "Heard back" },
  { status: "interview", label: "Interview" },
  { status: "offer", label: "Offer" },
  { status: "rejected", label: "Rejected" },
];

const DAY = 24 * 60 * 60 * 1000;

export default async function Tracker({ searchParams }: PageProps<"/app/tracker">) {
  const sp = await searchParams;
  const { user, profiles, unfinished, current } = await appContext(sp.profile);
  const balance = await balanceFor(user, current);
  const labels = new Map(profiles.map((p) => [p.id, p.label]));
  const jobs = await db.query.jobs.findMany({
    where: inArray(
      schema.jobs.profileId,
      profiles.map((p) => p.id),
    ),
    orderBy: desc(schema.jobs.statusChangedAt),
  });
  const tracked = jobs.filter((j) => COLUMNS.some((c) => c.status === j.status));

  return (
    <AppShell tab="tracker" user={user} profiles={profiles} unfinished={unfinished} current={current} balance={balance}>
      <main className="w-full max-w-5xl flex-1 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <p className="text-sm text-white/45">All headhunters</p>
        <h1 className="font-display mt-1 text-3xl font-medium tracking-tight text-white">Tracker</h1>
        <p className="mt-2 text-white/55">Every job you&rsquo;re applying to, from &ldquo;to apply&rdquo; to offer.</p>
        {tracked.some((j) => j.status === "saved") && (
          <div className="mt-6">
            <ApplyAllButton count={tracked.filter((j) => j.status === "saved").length} detailsComplete={detailsComplete(user.applicant)} />
          </div>
        )}

        {tracked.length === 0 ? (
          <div className="mt-8 rounded-3xl bg-surface px-6 py-16 text-center">
            <Ninja mood="sad" className="mx-auto size-16" />
            <h2 className="font-display mt-4 text-xl font-medium text-white">Nothing here yet</h2>
            <p className="mt-3 text-muted">Jobs you save or apply for from your shortlist show up here.</p>
          </div>
        ) : (
          <div className="mt-8 space-y-10">
            {COLUMNS.map((col) => {
              const items = tracked.filter((j) => j.status === col.status);
              if (!items.length) return null;
              return (
                <section key={col.status}>
                  <h2 className="font-display flex items-center gap-2 text-sm font-medium text-ink">
                    {col.label} <span className="tag text-xs">{items.length}</span>
                  </h2>
                  <ul className="mt-3 divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-surface">
                    {items.map((j) => {
                      const stale =
                        j.status === "applied" && j.statusChangedAt && Date.now() - j.statusChangedAt.getTime() > 7 * DAY;
                      return (
                        <li key={j.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
                          <CompanyLogo name={j.company} domain={j.companyDomain} size="sm" />
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/app/jobs/${j.id}`}
                              className="font-display font-medium text-white hover:underline hover:decoration-mist hover:underline-offset-4"
                            >
                              {j.title}
                            </Link>
                            <p className="text-sm text-muted">
                              {j.company}
                              {profiles.length > 1 && <> · {labels.get(j.profileId)}</>}
                              {j.statusChangedAt && <> · {j.statusChangedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</>}
                            </p>
                            {stale && (
                              <p className="mt-1 text-sm text-rose">Applied over a week ago. Any news from {j.company}?</p>
                            )}
                          </div>
                          <MoveJob jobId={j.id} status={j.status} />
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </AppShell>
  );
}
