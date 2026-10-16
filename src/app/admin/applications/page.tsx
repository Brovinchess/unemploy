import Link from "next/link";
import { PIPELINE, sortParams, stageLabel, when } from "@/lib/admin";
import { applications } from "@/lib/admin-data";
import { Badge, Cap, Card, Ext, Page, PageHead, SectionTitle, SortLink, Stat, Table, Tiles, UserLink, stageTone } from "../ui";

const BASE = "/admin/applications";
const MAX_ROWS = 500;
const STALE_DAYS = 7;

// The pipeline across everyone: what people did with the jobs, and the form questions still waiting on them.
export default async function Applications({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const { key, dir } = sortParams(q, "changed");
  const { byStage, total, staleTotal, rows, waitingTotal, waiting } = await applications({ stage: q.stage || undefined, stale: !!q.stale, sort: key, dir });
  const col = (k: string, label: string) => <SortLink k={k} label={label} base={BASE} q={q} sort={key} dir={dir} />;

  return (
    <Page>
      <PageHead section="Applications" title="Pipeline across all users" description={`Every job someone kept, by where it is now. “Stale” means applied more than ${STALE_DAYS} days ago with no change since.`} />

      <Tiles cols={6} className="mt-6">
        {PIPELINE.map((s) => (
          <Stat key={s} label={stageLabel(s)} value={byStage[s] ?? 0} href={s === "saved" ? `/admin/jobs?days=365&stage=saved` : `${BASE}?stage=${s}`} />
        ))}
      </Tiles>

      <SectionTitle
        title={`Applied or further (${total})`}
        hint={
          <>
            {staleTotal} stale.{" "}
            {q.stale ? (
              <Link href={BASE} className="underline underline-offset-2 hover:text-white">Show all</Link>
            ) : (
              <Link href={`${BASE}?stale=1`} className="underline underline-offset-2 hover:text-white">Only stale</Link>
            )}
            {q.stage && (
              <>
                {" · "}
                <Link href={BASE} className="underline underline-offset-2 hover:text-white">Clear stage filter</Link>
              </>
            )}
          </>
        }
      />
      <div className="mt-3">
        <Table
          head={[col("who", "User"), col("company", "Company"), col("title", "Title"), col("stage", "Stage"), col("changed", "Stage changed"), col("age", "Days since"), "Flag"]}
          rows={rows.map((r) => [
            <UserLink key="u" id={r.userId} name={r.who} />,
            r.company,
            <Ext key={r.id} href={r.url}>{r.title}</Ext>,
            <Badge key="s" tone={stageTone(r.status)}>{stageLabel(r.status)}</Badge>,
            when(r.changed),
            r.age,
            r.stale ? <Badge key="f" tone="amber">stale</Badge> : "",
          ])}
          empty="Nobody has applied yet."
        />
        <Cap shown={MAX_ROWS} total={total} />
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <Card title={`Questions waiting on people (${waitingTotal})`} hint="Form questions the headhunter could not answer from the person's facts.">
          <Table head={["User", "Waiting", "Oldest"]} rows={waiting.map((w) => [<UserLink key={w.uid} id={w.uid} name={w.name} />, <Badge key="n" tone="amber">{w.n}</Badge>, `${when(w.oldest)} (${w.days} days)`])} empty="Nothing waiting." emptyMood="happy" />
        </Card>
      </div>
    </Page>
  );
}
