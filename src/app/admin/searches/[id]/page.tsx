import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { daysAgo, mins, pushDetails, ratio, stageLabel, tally, when } from "@/lib/admin";
import { DROP_LABELS } from "@/lib/dropped";
import { summarizePreferences } from "@/lib/preferences";
import { Card, Counts, Ext, Facts, PageHead, Stat, Table, UserLink } from "../../ui";

// One search, with everything that happened between its start and end.
export default async function SearchDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const now = daysAgo(0);
  const search = await db.query.searches.findFirst({ where: eq(schema.searches.id, id) });
  if (!search) notFound();
  const end = search.endedAt ?? now;
  const between = (col: typeof schema.jobs.createdAt | typeof schema.leads.createdAt | typeof schema.ingestLog.createdAt) => and(gte(col, search.startedAt), lte(col, end));
  const [profile, jobs, leads, pushes] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(schema.profiles.id, search.profileId), columns: { id: true, userId: true, label: true, mindName: true, status: true, preferences: true } }),
    db.query.jobs.findMany({ where: and(eq(schema.jobs.profileId, search.profileId), between(schema.jobs.createdAt)), orderBy: asc(schema.jobs.createdAt) }),
    db.query.leads.findMany({ where: and(eq(schema.leads.profileId, search.profileId), between(schema.leads.createdAt)), orderBy: asc(schema.leads.createdAt) }),
    db.query.ingestLog.findMany({ where: and(eq(schema.ingestLog.profileId, search.profileId), between(schema.ingestLog.createdAt)), orderBy: asc(schema.ingestLog.createdAt) }),
  ]);
  const user = profile ? await db.query.users.findFirst({ where: eq(schema.users.id, profile.userId), columns: { id: true, username: true } }) : null;
  const minutes = mins(search.startedAt, end) ?? 1;
  const cognition = search.cognitionUsed != null ? Math.round(Number(search.cognitionUsed)) : null;
  const refused = pushes.flatMap((p) => pushDetails(p.detail).filter((x) => x.code));

  // Timeline: start, nudge, every push, end.
  type Event = { at: Date; what: string; detail?: string };
  const events: Event[] = [{ at: search.startedAt, what: "Search started", detail: `${search.jobsWanted} jobs wanted${search.focus ? `, focus: ${search.focus}` : ""}` }];
  if (search.nudgedAt) events.push({ at: search.nudgedAt, what: "Nudged", detail: "Nothing had arrived; the Mind was asked to send what it had." });
  for (const p of pushes) {
    const codes = tally(pushDetails(p.detail).filter((x) => x.code), (x) => x.code!).map(([c, n]) => `${c} ×${n}`).join(", ");
    events.push({ at: p.createdAt, what: p.dryRun ? "Dry run" : "Push", detail: `${p.accepted} accepted, ${p.rejected} rejected${codes ? ` (${codes})` : ""}` });
  }
  if (search.endedAt) events.push({ at: search.endedAt, what: `Ended: ${search.endReason ?? "unknown"}`, detail: `${search.jobsAdded ?? 0} jobs added` });
  events.sort((a, b) => a.at.getTime() - b.at.getTime());

  const byReason = new Map<string, typeof leads>();
  for (const l of leads) byReason.set(l.reason, [...(byReason.get(l.reason) ?? []), l]);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <PageHead section="Searches" title={`Search on ${when(search.startedAt)}`}>
        <p className="mt-2 text-sm text-white/55">
          <Link href="/admin/searches" className="underline underline-offset-2 hover:text-white">All searches</Link>
          {" · "}
          {user && <UserLink id={user.id} name={user.username ?? "(no name yet)"} />}
          {profile && ` · ${profile.label}${profile.mindName ? ` (${profile.mindName})` : ""}`}
        </p>
      </PageHead>

      <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Status" value={search.endedAt ? search.endReason ?? "ended" : "running"} hint={search.endedAt ? when(search.endedAt) : `${minutes} min so far`} />
        <Stat label="Wanted" value={search.jobsWanted} />
        <Stat label="Delivered" value={search.jobsAdded ?? jobs.length} hint={`${jobs.length} jobs in this window`} />
        <Stat label="Cognition" value={cognition ?? "–"} hint={cognition != null && jobs.length ? `${Math.round(cognition / jobs.length)} per job` : "read from the ledger at the end"} />
        <Stat label="Minutes" value={minutes} />
        <Stat label="Jobs per hour" value={ratio(jobs.length, minutes / 60)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Timeline">
          <ol className="space-y-2 text-sm">
            {events.map((e, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-32 shrink-0 tabular-nums text-white/45">{when(e.at)}</span>
                <span>
                  <span className="text-white">{e.what}</span>
                  {e.detail && <span className="text-white/55"> · {e.detail}</span>}
                </span>
              </li>
            ))}
            {!search.endedAt && <li className="text-white/40">Still running.</li>}
          </ol>
        </Card>
        <Card title="Headhunter">
          {profile ? (
            <Facts
              rows={[
                ["Label", profile.label],
                ["Mind", profile.mindName ?? ""],
                ["Status", profile.status.replace(/_/g, " ")],
                ["Balance", search.balanceStart != null ? `${Math.round(search.balanceStart)} → ${search.balanceEnd != null ? Math.round(search.balanceEnd) : "?"}` : ""],
                ...(profile.preferences ? summarizePreferences(profile.preferences).map((r) => [r.label, r.value] as [string, string]) : []),
              ]}
            />
          ) : (
            <p className="text-sm text-white/40">This headhunter was deleted.</p>
          )}
        </Card>
      </div>

      <h2 className="font-display mt-10 text-xl font-medium">Jobs delivered ({jobs.length})</h2>
      <div className="mt-3">
        <Table
          head={["When", "Company", "Title", "Match", "Place", "Stage"]}
          rows={jobs.map((j) => [when(j.createdAt), j.company, <Ext key={j.id} href={j.url}>{j.title}</Ext>, `${Math.round(j.matchScore)}%`, [j.city, j.country].filter(Boolean).join(", "), stageLabel(j.status)])}
          empty="No jobs arrived during this search."
        />
      </div>

      <h2 className="font-display mt-10 text-xl font-medium">Leads dropped ({leads.length})</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <Counts title="By reason" total={leads.length} rows={tally(leads, (l) => DROP_LABELS[l.reason] ?? l.reason)} />
        <div className="md:col-span-2 space-y-4">
          {[...byReason.entries()].map(([reason, list]) => (
            <Card key={reason} title={`${DROP_LABELS[reason as keyof typeof DROP_LABELS] ?? reason} (${list.length})`}>
              <Table head={["When", "Company", "Title", "The Mind's note"]} rows={list.map((l) => [when(l.createdAt), l.company, l.url ? <Ext key={l.id} href={l.url}>{l.title}</Ext> : l.title, l.note ?? ""])} />
            </Card>
          ))}
          {!leads.length && <p className="text-sm text-white/40">No leads were reported dropped.</p>}
        </div>
      </div>

      <h2 className="font-display mt-10 text-xl font-medium">Pushes ({pushes.length})</h2>
      <p className="mt-1 text-sm text-white/50">Every POST the Mind made to the app during this search, and what the app refused.</p>
      <div className="mt-3">
        <Table
          head={["When", "Kind", "Accepted", "Rejected", "Codes"]}
          rows={pushes.map((p) => [when(p.createdAt), p.dryRun ? "dry run" : "push", p.accepted, p.rejected, tally(pushDetails(p.detail).filter((x) => x.code), (x) => x.code!).map(([c, n]) => `${c} ×${n}`).join(", ")])}
          empty="The Mind made no pushes during this search."
        />
      </div>
      {refused.length > 0 && (
        <div className="mt-4">
          <Table head={["Code", "Link", "What it was told"]} rows={refused.map((r) => [r.code, (r.url ?? "").replace(/^https?:\/\//, "").slice(0, 60), (r.hint ?? "").slice(0, 220)])} />
        </div>
      )}
    </main>
  );
}
