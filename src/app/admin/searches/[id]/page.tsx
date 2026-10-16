import { notFound } from "next/navigation";
import { stageLabel, when } from "@/lib/admin";
import { searchDetail } from "@/lib/admin-data";
import { summarizePreferences } from "@/lib/preferences";
import type { Mood } from "@/components/brand";
import { Badge, Breadcrumb, Card, Clamp, Counts, Empty, Ext, Facts, Hero, Page, PageHead, SectionTitle, Stat, Table, Tiles, UserLink, endTone, hhTone, stageTone } from "../../ui";

// One search, with everything that happened between its start and end.
export default async function SearchDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await searchDetail(id);
  if (!data) notFound();
  const { search, profile, user, open, minutes, cognition, events, jobs, leads, leadsByReason, leadGroups, pushes, refused } = data;

  const mood: Mood = open ? "searching" : search.endReason === "finished" ? "happy" : "sad";
  const who = `${user?.username ?? "(no name yet)"}${profile ? ` · ${profile.label}${profile.mindName ? ` (${profile.mindName})` : ""}` : ""}`;

  return (
    <Page>
      <PageHead section="Searches" title={`Search on ${when(search.startedAt)}`} description={who} />
      <div className="mt-5">
        <Breadcrumb items={[["Searches", "/admin/searches"], ...(user ? ([[user.username ?? "(no name yet)", `/admin/users/${user.id}`]] as [string, string?][]) : []), [when(search.startedAt)]]} />
      </div>
      <Hero
        mood={mood}
        title={open ? "Still searching" : search.endReason === "finished" ? "Finished" : `Ended: ${search.endReason ?? "unknown"}`}
        subtitle={open ? `Running for ${minutes} minutes so far.` : `Ended ${when(search.endedAt)} after ${minutes} minutes, ${search.jobsAdded ?? jobs.length} jobs added.`}
        badge={<Badge tone={endTone(search.endReason, open)}>{open ? "open" : search.endReason ?? "ended"}</Badge>}
      >
        <div className="mt-3">
          <Facts
            rows={[
              ["Who", user ? <UserLink id={user.id} name={user.username ?? "(no name yet)"} /> : ""],
              ["Headhunter", profile ? `${profile.label}${profile.mindName ? ` (${profile.mindName})` : ""}` : "deleted"],
              ["Wanted", `${search.jobsWanted} jobs${search.focus ? `, focus: ${search.focus}` : ""}`],
            ]}
          />
        </div>
      </Hero>

      <Tiles cols={8} className="mt-6">
        <Stat label="Status" value={search.endedAt ? search.endReason ?? "ended" : "running"} hint={search.endedAt ? when(search.endedAt) : `${minutes} min so far`} />
        <Stat label="Wanted" value={search.jobsWanted} />
        <Stat label="Delivered" value={search.jobsAdded ?? jobs.length} hint={`${jobs.length} jobs in this window`} />
        <Stat label="Cognition" value={cognition ?? "–"} hint={cognition != null && jobs.length ? `${Math.round(cognition / jobs.length)} per job` : "read from the ledger at the end"} />
        <Stat label="Minutes" value={minutes} />
        <Stat label="Via pool" value={search.poolHits} hint="jobs the pool pointed to" />
        <Stat label="Opened" value={search.opened ?? jobs.length + leads.length} hint={search.opened != null ? "jobs plus dropped leads" : "so far"} />
      </Tiles>
      {search.summary && <p className="admin-text-2 mt-4 text-sm">How it went: {search.summary}.</p>}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Timeline">
          <ol className="space-y-2.5 text-sm">
            {events.map((e, i) => (
              <li key={i} className="flex gap-3">
                <span className="admin-text-3 w-28 shrink-0 tabular-nums">{when(e.at)}</span>
                <span className="relative pl-4">
                  <span className={`absolute left-0 top-1.5 size-2 rounded-full ${i === 0 ? "bg-teal-400" : i === events.length - 1 && search.endedAt ? "bg-coral" : "bg-white/30"}`} aria-hidden />
                  <span className="text-white">{e.what}</span>
                  {e.detail && <span className="admin-text-2"> · {e.detail}</span>}
                </span>
              </li>
            ))}
            {!search.endedAt && <li className="admin-text-3 pl-[7.75rem]">Still running.</li>}
          </ol>
        </Card>
        <Card title="Headhunter">
          {profile ? (
            <Facts
              rows={[
                ["Label", profile.label],
                ["Mind", profile.mindName ?? ""],
                ["Status", <Badge key="s" tone={hhTone(profile.status)}>{profile.status.replace(/_/g, " ")}</Badge>],
                ["Balance", search.balanceStart != null ? `${Math.round(search.balanceStart)} → ${search.balanceEnd != null ? Math.round(search.balanceEnd) : "?"}` : ""],
                ...(profile.preferences ? summarizePreferences(profile.preferences).map((r) => [r.label, r.value] as [string, string]) : []),
              ]}
            />
          ) : (
            <Empty mood="sad">This headhunter was deleted.</Empty>
          )}
        </Card>
      </div>

      <SectionTitle title={`Jobs delivered (${jobs.length})`} />
      <div className="mt-3">
        <Table
          head={["When", "Company", "Title", "Match", "Place", "Stage", "Source"]}
          rows={jobs.map((j) => [when(j.createdAt), j.company, <Ext key={j.id} href={j.url}>{j.title}</Ext>, `${Math.round(j.matchScore)}%`, j.place, <Badge key="s" tone={stageTone(j.status)}>{stageLabel(j.status)}</Badge>, j.fromPool ? <Badge key="p" tone="teal">pool</Badge> : ""])}
          empty="No jobs arrived during this search."
          emptyMood={open ? "searching" : "sad"}
        />
      </div>

      <SectionTitle title={`Leads dropped (${leads.length})`} />
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <Counts title="By reason" total={leads.length} rows={leadsByReason} />
        <div className="space-y-6 md:col-span-2">
          {leadGroups.map((g) => (
            <div key={g.reason}>
              <h3 className="admin-text-2 mb-2 text-sm font-medium">
                {g.label} <span className="admin-text-3">({g.leads.length})</span>
              </h3>
              <Table head={["When", "Company", "Title", "The Mind's note"]} rows={g.leads.map((l) => [when(l.createdAt), l.company, l.url ? <Ext key={l.id} href={l.url}>{l.title}</Ext> : l.title, <Clamp key="n" text={l.note} />])} />
            </div>
          ))}
          {!leads.length && (
            <div className="admin-panel rounded-2xl">
              <Empty mood="happy">No leads were reported dropped.</Empty>
            </div>
          )}
        </div>
      </div>

      <SectionTitle title={`Pushes (${pushes.length})`} hint="Every POST the Mind made to the app during this search, and what the app refused." />
      <div className="mt-3">
        <Table
          head={["When", "Kind", "Accepted", "Rejected", "Codes"]}
          rows={pushes.map((p) => [when(p.createdAt), p.dryRun ? <Badge key="k" tone="muted">dry run</Badge> : <Badge key="k" tone="teal">push</Badge>, p.accepted, p.rejected ? <span key="r" className="text-rose-300">{p.rejected}</span> : 0, p.codes])}
          empty="The Mind made no pushes during this search."
          emptyMood="sleeping"
        />
      </div>
      {refused.length > 0 && (
        <div className="mt-4">
          <Table head={["Code", "Link", "What it was told"]} rows={refused.map((r) => [r.code, r.url.replace(/^https?:\/\//, "").slice(0, 60), <Clamp key="h" text={r.hint.slice(0, 220)} />])} />
        </div>
      )}
    </Page>
  );
}
