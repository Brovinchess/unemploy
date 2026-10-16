import { pct, when } from "@/lib/admin";
import { growth } from "@/lib/admin-data";
import { Badge, BarChart, CHART, Card, Counts, DaysPicker, Page, PageHead, SectionTitle, Stat, Table, Tiles, UserLink, daysParam } from "../ui";

const BASE = "/admin/growth";

// Where people come from: signups, friend referrals, and the pre-launch waitlist.
export default async function Growth({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const days = daysParam(q, 30);
  const d = await growth(days);
  const series = [
    { label: "Organic", color: CHART.slate, values: d.series.organic },
    { label: "Referred", color: CHART.coral, values: d.series.referred },
  ];
  const converted = d.waitlist.filter((w) => w.user);

  return (
    <Page>
      <PageHead section="Growth" title="Signups, referrals and the waitlist" description="Where people come from: organic signups, friends via links, and the pre-launch waitlist." controls={<DaysPicker days={days} base={BASE} q={q} />} />

      <Tiles cols={6} className="mt-6">
        <Stat label={`Signups, ${days}d`} value={d.signups} hint={`${d.referredSignups} referred`} />
        <Stat label="Accounts, all time" value={d.users} />
        <Stat label="Friends via links" value={d.referrals} hint={`${d.referrers} referrers`} />
        <Stat label="Friends who deployed" value={d.friendsDeployed} />
        <Stat label="Waitlist" value={d.waitlistTotal} hint={`${d.waitlistVerified} verified`} />
        <Stat label="Waitlist → signed up" value={d.converted} hint={pct(d.converted, d.waitlistTotal)} />
      </Tiles>

      <div className="mt-6">
        <Card>
          <BarChart title="Signups per day" keys={d.keys} series={series} height={170} />
        </Card>
      </div>

      <SectionTitle title={`Referrals (${d.referrals})`} />
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table
            head={["Joined", "Friend", "Referred by", "Status", "Deployed", "Cognition spent"]}
            rows={d.referralRows.map((r) => [
              when(r.createdAt),
              <UserLink key="f" id={r.friendId} name={r.friend} />,
              <UserLink key="r" id={r.referrerId} name={r.referrer} />,
              <Badge key="s" tone="slate">{r.status}</Badge>,
              r.deployed ? <Badge key="d" tone="green">yes</Badge> : <span key="d" className="text-white/30">no</span>,
              r.spent,
            ])}
            empty="Nobody has joined through a link yet."
          />
        </div>
        <Card title="Top referrers">
          <Table head={["User", "Friends", "Link"]} rows={d.topReferrers.map((r) => [<UserLink key={r.id} id={r.id} name={r.name} />, r.n, <span key="l" className="admin-text-2 font-mono text-xs">careerninja.app/r/{r.code ?? ""}</span>])} empty="No referrers yet." />
        </Card>
      </div>

      <SectionTitle title={`Waitlist (${d.waitlistTotal})`} hint={`${d.waitlistVerified} verified their email. ${d.converted} have since signed up with the same email.`} />
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <Counts title="Country" total={d.waitlistTotal} rows={d.byCountry} />
        <Counts title="Role area" total={d.waitlistTotal} rows={d.byRole} />
        <Card title="Converted" hint="Waitlist emails that later became accounts.">
          <Table
            head={["Waitlisted", "Signed up", "User"]}
            rows={converted.map((w) => [when(w.createdAt).slice(0, 10), when(w.user!.createdAt).slice(0, 10), <UserLink key={w.user!.id} id={w.user!.id} name={w.user!.name} />])}
            empty="None yet."
          />
        </Card>
      </div>
      <div className="mt-4">
        <Table
          head={["Joined", "Name", "Email", "Country", "Role area", "Verified", "Came with code", "Signed up"]}
          empty="The waitlist is empty."
          emptyMood="sleeping"
          rows={d.waitlist.map((w) => [
            when(w.createdAt),
            w.name ?? "",
            w.email,
            w.country ?? "",
            w.roleArea ?? "",
            w.verified ? <Badge key="v" tone="green">yes</Badge> : <span key="v" className="text-white/30">no</span>,
            w.referredBy ?? "",
            w.user ? <Badge key="s" tone="teal">yes</Badge> : "",
          ])}
        />
      </div>
    </Page>
  );
}
