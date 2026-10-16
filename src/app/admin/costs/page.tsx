import { ratio, sortParams } from "@/lib/admin";
import { costs } from "@/lib/admin-data";
import { COGNITION_USD } from "@/lib/preferences";
import { BarChart, CHART, Card, DaysPicker, Empty, Page, PageHead, SectionTitle, SortLink, Stat, Table, Tiles, UserLink, daysParam } from "../ui";

const BASE = "/admin/costs";

// What the headhunters spend. Cognition comes from Hello Minds' ledger, read once when a
// search ends (lib/search recordEnd), so open searches show nothing yet.
export default async function Costs({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const days = daysParam(q, 30);
  const { key, dir } = sortParams(q, "cognition");
  const d = await costs({ days, sort: key, dir });
  const col = (k: string, label: string) => <SortLink k={k} label={label} base={BASE} q={q} sort={key} dir={dir} />;
  const usd = (c: number) => `$${(c * COGNITION_USD).toFixed(2)}`;

  return (
    <Page>
      <PageHead
        section="Costs"
        title="Cognition spent by headhunters"
        description={`Read from the Mind's ledger when a search ends, so running searches show nothing yet. Dollar figures use the current rate of ${usd(1)} per unit.`}
        controls={<DaysPicker days={days} base={BASE} q={q} />}
      />

      <Tiles cols={6} className="mt-6">
        <Stat label="Cognition" value={Math.round(d.cognition)} hint={usd(d.cognition)} />
        <Stat label="Searches" value={d.searches} hint={`${d.costed} with a cost recorded`} />
        <Stat label="Jobs delivered" value={d.jobs} />
        <Stat label="Per search" value={d.costed ? Math.round(d.cognition / d.costed) : "–"} hint={d.costed ? usd(d.cognition / d.costed) : undefined} />
        <Stat label="Per job" value={d.jobs ? Math.round(d.cognition / d.jobs) : "–"} hint={d.jobs ? usd(d.cognition / d.jobs) : undefined} />
        <Stat label="Per day" value={Math.round(d.cognition / (days + 1))} hint={usd(d.cognition / (days + 1))} />
      </Tiles>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <BarChart title="Cognition per day (by search end)" keys={d.keys} series={[{ label: "Cognition", values: d.perDay, color: CHART.amber }]} height={170} />
        </Card>
        <Card title="Cost per search" hint={`${d.costed} finished searches with a cost.`}>
          {d.costed ? (
            <dl className="grid grid-cols-3 gap-4 text-center">
              {[
                ["Min", d.min ?? 0],
                ["Median", d.median ?? 0],
                ["Max", d.max ?? 0],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="admin-text-3 text-[11px] font-semibold uppercase tracking-wide">{k}</dt>
                  <dd className="font-display mt-1 text-xl tabular-nums text-white">{Math.round(Number(v))}</dd>
                  <dd className="admin-text-3 text-xs">{usd(Number(v))}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <Empty mood="sleeping">No finished searches in this window.</Empty>
          )}
          {d.costed > 0 && (
            <p className="admin-text-3 mt-4 text-xs">
              {d.zeros} searches recorded zero cognition (the Mind did nothing, or the ledger was empty).
            </p>
          )}
        </Card>
      </div>

      <SectionTitle title="Per user" hint={`Jobs here are the searches' own counts (jobs added by the end of each search); the Jobs page counts by delivery time. Jobs per search overall: ${ratio(d.jobs, d.searches)}.`} />
      <div className="mt-3">
        <Table
          head={[col("name", "User"), col("searches", "Searches"), col("jobs", "Jobs"), col("cognition", "Cognition"), col("perJob", "Per job"), col("perSearch", "Per search"), "Cost"]}
          rows={d.rows.map((r) => [<UserLink key={r.uid} id={r.uid} name={r.name} />, r.searches, r.jobs, r.cognition, r.perJob != null ? Math.round(r.perJob) : "–", r.perSearch != null ? Math.round(r.perSearch) : "–", usd(r.cognition)])}
          empty="No searches in this window."
          emptyMood="sleeping"
        />
      </div>
    </Page>
  );
}
