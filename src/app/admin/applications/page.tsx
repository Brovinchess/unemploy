import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { APPLIED_PLUS_LIST, PIPELINE, STAGE_ORDER, WAITING_QUESTION_LIST, daysAgo, daysBetween, directory, sortParams, sortRows, stageLabel, when } from "@/lib/admin";
import { Badge, Cap, Card, Ext, Page, PageHead, SectionTitle, SortLink, Stat, Table, Tiles, UserLink, stageTone } from "../ui";

const BASE = "/admin/applications";
const MAX_ROWS = 500;
const STALE_DAYS = 7;

// The pipeline across everyone: what people did with the jobs, and the form questions still waiting on them.
export default async function Applications({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const now = daysAgo(0);
  const { key, dir } = sortParams(q, "changed");
  const [d, counts, applied, questions] = await Promise.all([
    directory(),
    db.query.jobs.findMany({ where: inArray(schema.jobs.status, PIPELINE), columns: { status: true } }),
    db.query.jobs.findMany({ where: inArray(schema.jobs.status, APPLIED_PLUS_LIST), orderBy: desc(schema.jobs.statusChangedAt) }),
    db.query.questions.findMany({ where: inArray(schema.questions.status, WAITING_QUESTION_LIST), columns: { userId: true, createdAt: true } }),
  ]);
  const byStage = new Map<string, number>();
  for (const j of counts) byStage.set(j.status, (byStage.get(j.status) ?? 0) + 1);

  let rows = applied.map((j) => {
    const changed = j.statusChangedAt ?? j.createdAt;
    const age = daysBetween(changed, now);
    return { ...j, who: d.who(j.profileId), userId: d.userOfProfile(j.profileId), changed, age, stale: j.status === "applied" && age > STALE_DAYS };
  });
  if (q.stage) rows = rows.filter((r) => r.status === q.stage);
  if (q.stale) rows = rows.filter((r) => r.stale);
  rows = sortRows(rows, key, dir, {
    who: (r) => r.who,
    company: (r) => r.company,
    title: (r) => r.title,
    stage: (r) => STAGE_ORDER.indexOf(r.status),
    changed: (r) => r.changed,
    age: (r) => r.age,
  });
  const col = (k: string, label: string) => <SortLink k={k} label={label} base={BASE} q={q} sort={key} dir={dir} />;

  // Questions waiting, per person, with the oldest one.
  const waiting = [...new Set(questions.map((x) => x.userId))]
    .map((uid) => {
      const mine = questions.filter((x) => x.userId === uid);
      const oldest = mine.map((x) => x.createdAt).sort((a, b) => a.getTime() - b.getTime())[0];
      return { uid, name: d.nameOf(uid), n: mine.length, oldest };
    })
    .sort((a, b) => a.oldest.getTime() - b.oldest.getTime());

  return (
    <Page>
      <PageHead section="Applications" title="Pipeline across all users" description={`Every job someone kept, by where it is now. “Stale” means applied more than ${STALE_DAYS} days ago with no change since.`} />

      <Tiles cols={6} className="mt-6">
        {PIPELINE.map((s) => (
          <Stat key={s} label={stageLabel(s)} value={byStage.get(s) ?? 0} href={s === "saved" ? `/admin/jobs?days=365&stage=saved` : `${BASE}?stage=${s}`} />
        ))}
      </Tiles>

      <SectionTitle
        title={`Applied or further (${rows.length})`}
        hint={
          <>
            {rows.filter((r) => r.stale).length} stale.{" "}
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
          rows={rows.slice(0, MAX_ROWS).map((r) => [
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
        <Cap shown={MAX_ROWS} total={rows.length} />
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <Card title={`Questions waiting on people (${questions.length})`} hint="Form questions the headhunter could not answer from the person's facts.">
          <Table head={["User", "Waiting", "Oldest"]} rows={waiting.map((w) => [<UserLink key={w.uid} id={w.uid} name={w.name} />, <Badge key="n" tone="amber">{w.n}</Badge>, `${when(w.oldest)} (${daysBetween(w.oldest, now)} days)`])} empty="Nothing waiting." emptyMood="happy" />
        </Card>
      </div>
    </Page>
  );
}
