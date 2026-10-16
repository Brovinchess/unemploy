import Link from "next/link";
import { pct, ratio, when } from "@/lib/admin";
import { overview } from "@/lib/admin-data";
import { Alerts, Badge, BarChart, CHART, Card, Counts, DaysPicker, Funnel, GroupLabel, Page, PageHead, Stat, Table, Tiles, UserLink, daysParam, endTone } from "./ui";

// The dashboard: four groups of plain numbers (people, searches, jobs, cost and quality), each
// answering one question, then what needs a look and who did what.
export default async function Overview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const days = daysParam(q, 7);
  const { keys, allTime, window: w, funnel, trend, byStage, byReason, alerts, recent, countries, people } = await overview(days);
  const min = (n: number | null) => (n == null ? "–" : n >= 90 ? `${Math.floor(n / 60)} h ${n % 60} min` : `${n} min`);

  return (
    <Page>
      <PageHead section="Overview" title="Career Ninja at a glance" description={`Who is here, what their headhunters did in the last ${days} days, and what it cost.`} controls={<DaysPicker days={days} base="/admin" />} />

      <GroupLabel>People</GroupLabel>
      <Tiles cols={5} className="mt-2">
        <Stat label="Accounts" value={allTime.users} hint={`${w.newUsers} new, ${w.referred} referred`} href="/admin/users" />
        <Stat label="Set up a headhunter" value={allTime.deployed} hint={`${pct(allTime.deployed, allTime.users)} of accounts`} href="/admin/headhunters" />
        <Stat label="Active" value={w.activeUsers} hint={`ran a search in ${days} days`} href={`/admin/users?active=${days}`} />
        <Stat label="Extension connected" value={allTime.extensionUsers} hint="accounts" />
        <Stat label="Searching right now" value={allTime.searchingNow} href="/admin/searches?open=1" />
      </Tiles>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Counts title="Where people are from" total={allTime.users} rows={countries} />
        <Card title="How far people get" hint="All accounts. Each step shows the share of the step before." className="rise rise-1">
          <Funnel steps={funnel} />
        </Card>
      </div>

      <GroupLabel>Searches, last {days} days</GroupLabel>
      <Tiles cols={6} className="mt-2">
        <Stat label="Searches" value={w.searches} hint={`${w.openSearches} still open`} href={`/admin/searches?days=${days}`} />
        <Stat label="Average length" value={min(w.avgMinutes)} hint="start to end" />
        <Stat label="First job after" value={min(w.firstJobMinutes)} hint="median" />
        <Stat label="Jobs asked for" value={w.wanted} hint={`${w.jobs} delivered, ${pct(w.jobs, w.wanted)}`} />
        <Stat label="Found via pool" value={w.poolJobs} hint={w.jobs ? `${pct(w.poolJobs, w.jobs)} of jobs` : undefined} />
        <Stat label="Ended with nothing" value={w.emptySearches} hint={`of ${w.finished} finished`} href={`/admin/searches?days=${days}&empty=1`} />
      </Tiles>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card><BarChart title="Searches per day" keys={keys} series={[{ label: "Searches", values: trend.searches, color: CHART.teal }]} /></Card>
        <Card><BarChart title="Jobs delivered per day" keys={keys} series={[{ label: "Jobs", values: trend.jobs, color: CHART.coral }]} /></Card>
      </div>

      <GroupLabel>Jobs, last {days} days</GroupLabel>
      <Tiles cols={5} className="mt-2">
        <Stat label="Delivered" value={w.jobs} href={`/admin/jobs?days=${days}`} />
        <Stat label="Kept" value={w.kept} hint={`${pct(w.kept, w.jobs)} of delivered`} />
        <Stat label="Applied or further" value={w.applied} href="/admin/applications" />
        <Stat label="Interviews and offers" value={w.interviews} />
        <Stat label="Jobs ever delivered" value={allTime.jobs} hint={`${allTime.appliedPlus} applied or further`} href="/admin/jobs?days=365" />
      </Tiles>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Counts title="What people did with them" total={w.jobs} rows={byStage} />
        <Counts title="Why leads were dropped" total={w.leads} rows={byReason} />
      </div>

      <GroupLabel>Cost, last {days} days</GroupLabel>
      <Tiles cols={4} className="mt-2">
        <Stat label="Cognition used" value={Math.round(w.cognition)} href={`/admin/costs?days=${days}`} />
        <Stat label="Per search" value={w.searches ? Math.round(w.cognition / w.searches) : "–"} />
        <Stat label="Per job delivered" value={w.jobs ? Math.round(w.cognition / w.jobs) : "–"} />
        <Stat label="Leads opened per job" value={w.jobs ? Math.round(w.leads / w.jobs) : "–"} hint={`${w.leads} dropped`} href={`/admin/quality?days=${days}`} />
      </Tiles>
      <div className="mt-4">
        <Card><BarChart title="Cognition per day (by search end)" keys={keys} series={[{ label: "Cognition", values: trend.cognition, color: CHART.amber }]} /></Card>
      </div>

      <GroupLabel>Needs a look</GroupLabel>
      <div className="mt-2">
        <Card hint="Live checks; each line opens the page to act on." className="rise rise-2">
          <Alerts items={alerts} />
        </Card>
      </div>

      <GroupLabel>Who searched, last {days} days</GroupLabel>
      <div className="mt-2">
        <Table
          head={["Person", "From", "Searches", "Jobs", "Kept", "Avg length", "Cognition"]}
          empty="Nobody searched in this window."
          emptyMood="sleeping"
          rows={people.map((p) => [<UserLink key={p.id} id={p.id} name={p.username ?? "(no name yet)"} />, p.country, p.searches, p.jobs, p.kept, min(p.avgMinutes), p.cognition])}
        />
      </div>

      <GroupLabel>Recent searches</GroupLabel>
      <div className="mt-2">
        <Table
          head={["Started", "Who", "Asked", "Got", "Cognition", "Took", "Ended"]}
          empty="No searches in this window."
          emptyMood="sleeping"
          rows={recent.map((s) => [
            <Link key={s.id} href={`/admin/searches/${s.id}`} className="text-white underline decoration-white/20 underline-offset-2 hover:decoration-coral">{when(s.startedAt)}</Link>,
            <UserLink key="u" id={s.userId} name={s.who} />,
            s.jobsWanted,
            s.jobsAdded ?? (s.open ? "…" : 0),
            s.cognitionUsed != null ? Math.round(Number(s.cognitionUsed)) : "",
            s.open ? `running, ${s.minutes} min so far` : `${s.minutes} min`,
            <Badge key="e" tone={endTone(s.endReason, s.open)}>{s.endReason ?? (s.open ? "open" : "ended")}</Badge>,
          ])}
        />
        <p className="admin-text-3 mt-2 text-xs">
          <Link href={`/admin/searches?days=${days}`} className="underline underline-offset-2 hover:text-white">All searches</Link> · {pct(w.finishedWithJobs, w.finished)} of finished searches delivered at least one job · {ratio(w.jobs, w.searches)} jobs per search.
        </p>
      </div>
    </Page>
  );
}
