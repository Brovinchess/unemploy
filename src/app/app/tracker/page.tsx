import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { JobStatus } from "@/db/schema";
import { AppHeader } from "@/components/app-header";
import { appContext } from "@/lib/app-context";
import { MoveJob } from "./move-job";
import { CompanyMark } from "@/components/logo";

const COLUMNS: { status: JobStatus; label: string }[] = [
  { status: "saved", label: "Saved" },
  { status: "applied", label: "Applied" },
  { status: "heard_back", label: "Heard back" },
  { status: "interview", label: "Interview" },
  { status: "offer", label: "Offer" },
  { status: "rejected", label: "Rejected" },
];

const DAY = 24 * 60 * 60 * 1000;

export default async function Tracker() {
  const { profiles } = await appContext();
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
    <>
      <AppHeader tab="tracker" profiles={profiles} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Tracker</h1>
        <p className="mt-2 text-muted">Every job you saved or applied for, across all your headhunters.</p>

        {tracked.length === 0 ? (
          <div className="card mt-8 px-6 py-12 text-center">
            <h2 className="font-display text-xl font-bold text-ink">Nothing here yet</h2>
            <p className="mt-3 text-muted">Jobs you save or apply for from your shortlist show up here.</p>
          </div>
        ) : (
          <div className="mt-8 space-y-10">
            {COLUMNS.map((col) => {
              const items = tracked.filter((j) => j.status === col.status);
              if (!items.length) return null;
              return (
                <section key={col.status}>
                  <h2 className="font-display flex items-center gap-2 text-sm font-bold text-ink">
                    {col.label} <span className="tag text-xs">{items.length}</span>
                  </h2>
                  <ul className="card mt-3 divide-y divide-line overflow-hidden">
                    {items.map((j) => {
                      const stale =
                        j.status === "applied" && j.statusChangedAt && Date.now() - j.statusChangedAt.getTime() > 7 * DAY;
                      return (
                        <li key={j.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
                          <CompanyMark name={j.company} size="sm" />
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/app?profile=${j.profileId}&job=${j.id}`}
                              className="font-display font-bold text-ink hover:underline hover:decoration-mist hover:underline-offset-4"
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
    </>
  );
}
