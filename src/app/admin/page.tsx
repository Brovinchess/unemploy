import Link from "next/link";
import { pct, when } from "@/lib/admin";
import { overview } from "@/lib/admin-data";
import { Alerts, Badge, BarChart, CHART, Card, Counts, DaysPicker, Funnel, GroupLabel, Page, PageHead, SectionTitle, Stat, Table, Tiles, UserLink, daysParam, endTone } from "./ui";

export default async function Overview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const days = daysParam(q, 7);
  const { keys, allTime, window: w, funnel, trend, byStage, byReason, alerts, recent } = await overview(days);

  return (
    <Page>
      <PageHead section="Overview" title="Career Ninja at a glance" description="What happened, what needs a look, and how people move through setup." controls={<DaysPicker days={days} base="/admin" />} />

      <GroupLabel>All time</GroupLabel>
      <Tiles cols={5} className="mt-2">
        <Stat label="Accounts" value={allTime.users} href="/admin/users" />
        <Stat label="Headhunters deployed" value={allTime.deployed} hint={`${allTime.live} live, ${allTime.searchingNow} searching now`} href="/admin/headhunters" />
        <Stat label="Jobs ever delivered" value={allTime.jobs} hint={`${allTime.appliedPlus} applied or further`} href="/admin/jobs?days=365" />
        <Stat label="Extension connected" value={allTime.extensionUsers} hint="accounts" />
        <Stat label="Email verified" value={allTime.emailVerified} hint="accounts" />
      </Tiles>

      <GroupLabel>Last {days} days</GroupLabel>
      <Tiles cols={6} className="mt-2">
        <Stat label="New accounts" value={w.newUsers} hint={`${w.referred} referred`} href={`/admin/growth?days=${days}`} />
        <Stat label="Active users" value={w.activeUsers} hint="ran a search" href={`/admin/users?active=${days}`} />
        <Stat label="Searches" value={w.searches} hint={`${w.openSearches} still open`} href={`/admin/searches?days=${days}`} />
        <Stat label="Jobs delivered" value={w.jobs} hint={`${w.kept} kept`} href={`/admin/jobs?days=${days}`} />
        <Stat label="Leads dropped" value={w.leads} hint={w.jobs ? `${Math.round(w.leads / w.jobs)} per job` : undefined} href={`/admin/quality?days=${days}`} />
        <Stat label="Cognition" value={Math.round(w.cognition)} hint={w.jobs && w.cognition ? `about ${Math.round(w.cognition / w.jobs)} per job` : undefined} href={`/admin/costs?days=${days}`} />
      </Tiles>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Onboarding funnel" hint="All accounts. Each step shows the share of the step before." className="rise rise-1">
          <Funnel steps={funnel} />
        </Card>
        <Card title="Needs a look" hint="Live checks; each line opens the page to act on." className="rise rise-2">
          <Alerts items={alerts} />
        </Card>
      </div>

      <SectionTitle title={`Per day, last ${days} days`} />
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <Card><BarChart title="Signups" keys={keys} series={[{ label: "Signups", values: trend.signups, color: CHART.coral }]} /></Card>
        <Card><BarChart title="Searches started" keys={keys} series={[{ label: "Searches", values: trend.searches, color: CHART.teal }]} /></Card>
        <Card><BarChart title="Jobs delivered" keys={keys} series={[{ label: "Jobs", values: trend.jobs, color: CHART.slate }]} /></Card>
        <Card><BarChart title="Cognition used (by search end)" keys={keys} series={[{ label: "Cognition", values: trend.cognition, color: CHART.amber }]} /></Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Counts title="Jobs by what the person did" total={w.jobs} rows={byStage} />
        <Counts title="Why leads were dropped" total={w.leads} rows={byReason} />
      </div>

      <SectionTitle
        title="Recent searches"
        hint={
          <>
            <Link href={`/admin/searches?days=${days}`} className="underline underline-offset-2 hover:text-white">All searches</Link> · {pct(w.finishedWithJobs, w.finished)} of finished searches delivered at least one job.
          </>
        }
      />
      <div className="mt-3">
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
      </div>
    </Page>
  );
}
