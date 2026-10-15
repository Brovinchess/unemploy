import { desc, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { STAGE_ORDER, daysAgo, directory, host, includes, sortParams, sortRows, stageLabel, tally, when } from "@/lib/admin";
import { workSettingLabel } from "@/lib/preferences";
import { Badge, Cap, ClearLink, Counts, DaysPicker, Ext, FilterForm, Page, PageHead, Select, SortLink, Table, TextInput, UserLink, daysParam, stageTone } from "../ui";

const BASE = "/admin/jobs";
const MAX_ROWS = 500;

export default async function Jobs({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const days = daysParam(q, 14);
  const since = daysAgo(days);
  const { key, dir } = sortParams(q, "when");
  const [d, all] = await Promise.all([directory(), db.query.jobs.findMany({ where: gte(schema.jobs.createdAt, since), orderBy: desc(schema.jobs.createdAt) })]);

  let rows = all.map((j) => ({ ...j, who: d.who(j.profileId), userId: d.userOfProfile(j.profileId), host: host(j.url), place: [j.city, j.country].filter(Boolean).join(", ") }));
  const user = d.userByName(q.user);
  if (q.user) rows = user ? rows.filter((r) => r.userId === user.id) : [];
  if (q.stage) rows = rows.filter((r) => r.status === q.stage);
  if (q.host) rows = rows.filter((r) => includes(r.host, q.host!));
  if (q.q) rows = rows.filter((r) => includes(r.company, q.q!) || includes(r.title, q.q!));
  rows = sortRows(rows, key, dir, {
    when: (r) => r.createdAt,
    who: (r) => r.who,
    match: (r) => r.matchScore,
    company: (r) => r.company,
    title: (r) => r.title,
    place: (r) => r.place,
    setting: (r) => r.workSetting,
    posted: (r) => r.postedOn,
    salary: (r) => r.salary,
    stage: (r) => STAGE_ORDER.indexOf(r.status),
    changed: (r) => r.statusChangedAt,
    host: (r) => r.host,
  });
  const col = (k: string, label: string) => <SortLink k={k} label={label} base={BASE} q={q} sort={key} dir={dir} />;
  const filtered = !!(q.user || q.stage || q.host || q.q);

  return (
    <Page>
      <PageHead
        section="Jobs"
        title={`${rows.length} jobs delivered`}
        description="Every job a headhunter sent, and what the person did with it."
        controls={
          <>
            <DaysPicker days={days} base={BASE} q={q} />
            <FilterForm q={q}>
              <TextInput name="q" value={q.q} placeholder="Company or title" />
              <TextInput name="user" value={q.user} placeholder="Username" size={12} />
              <TextInput name="host" value={q.host} placeholder="Link host" size={14} />
              <Select name="stage" value={q.stage} blank="Any stage" options={STAGE_ORDER.map((s) => [s, stageLabel(s)])} />
              {filtered && <ClearLink href={`${BASE}?days=${days}`} />}
            </FilterForm>
          </>
        }
      >
        {q.user && !user && <p className="mt-2 text-sm text-rose-300">No user called “{q.user}”.</p>}
      </PageHead>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Counts title="Stage" total={rows.length} rows={tally(rows, (j) => stageLabel(j.status))} />
        <Counts title="Work setting" total={rows.length} rows={tally(rows, (j) => workSettingLabel(j.workSetting ?? "unknown"))} />
        <Counts title="Where the link lives" total={rows.length} rows={tally(rows, (j) => j.host).slice(0, 10)} />
      </div>
      <div className="mt-6">
        <Table
          head={[col("when", "When"), col("who", "Who"), col("match", "Match"), col("company", "Company"), col("title", "Title"), col("place", "Place"), col("setting", "Setting"), col("posted", "Posted"), col("salary", "Salary"), col("stage", "Stage"), col("changed", "Stage changed"), col("host", "Link")]}
          empty="No jobs in this window."
          emptyMood="sleeping"
          rows={rows.slice(0, MAX_ROWS).map((j) => [
            when(j.createdAt),
            <UserLink key="u" id={j.userId} name={j.who} />,
            `${Math.round(j.matchScore)}%`,
            j.company,
            <span key="t" className="block max-w-64 truncate" title={j.title}>{j.title}</span>,
            j.place,
            workSettingLabel(j.workSetting),
            j.postedOn ?? j.postedAt ?? "",
            <span key="s" className="block max-w-40 truncate" title={j.salary ?? ""}>{j.salary ?? ""}{j.salary && j.salaryEstimated ? " (est.)" : ""}</span>,
            <Badge key="st" tone={stageTone(j.status)}>{stageLabel(j.status)}</Badge>,
            when(j.statusChangedAt),
            <Ext key={j.id} href={j.url}>{j.host}</Ext>,
          ])}
        />
        <Cap shown={MAX_ROWS} total={rows.length} />
      </div>
    </Page>
  );
}
