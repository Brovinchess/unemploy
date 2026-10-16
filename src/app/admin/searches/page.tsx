import Link from "next/link";
import { ratio, sortParams, when } from "@/lib/admin";
import { searches } from "@/lib/admin-data";
import { Badge, Cap, Check, Clamp, ClearLink, DaysPicker, FilterForm, Page, PageHead, SortLink, Stat, Table, TextInput, Tiles, UserLink, daysParam, endTone } from "../ui";

const BASE = "/admin/searches";
const MAX_ROWS = 500;

export default async function Searches({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const days = daysParam(q, 14);
  const { key, dir } = sortParams(q, "started");
  const { total, userFound, avgMinutes, jobsPerSearch, cogPerSearch, cogPerJob, rows } = await searches({ days, user: q.user || undefined, open: !!q.open, empty: !!q.empty, sort: key, dir });
  const col = (k: string, label: string) => <SortLink k={k} label={label} base={BASE} q={q} sort={key} dir={dir} />;

  return (
    <Page>
      <PageHead
        section="Searches"
        title={`${total} searches`}
        description="Every time a headhunter went out, what it was asked for and what came back."
        controls={
          <>
            <DaysPicker days={days} base={BASE} q={q} />
            <FilterForm q={q}>
              <TextInput name="user" value={q.user} placeholder="Username" size={14} />
              <Check name="open" checked={!!q.open} label="Still open" />
              <Check name="empty" checked={!!q.empty} label="Ended with no jobs" />
              {(q.user || q.open || q.empty) && <ClearLink href={`${BASE}?days=${days}`} />}
            </FilterForm>
          </>
        }
      >
        {q.user && !userFound && <p className="mt-2 text-sm text-rose-300">No user called “{q.user}”.</p>}
      </PageHead>
      <Tiles cols={4} className="mt-6">
        <Stat label="Average length" value={avgMinutes != null ? `${avgMinutes} min` : "–"} />
        <Stat label="Jobs per search" value={ratio(jobsPerSearch[0], jobsPerSearch[1])} />
        <Stat label="Cognition per search" value={cogPerSearch ?? "–"} />
        <Stat label="Cognition per job" value={cogPerJob ?? "–"} />
      </Tiles>
      <div className="mt-6">
        <Table
          head={[col("started", "Started"), col("who", "Who"), col("wanted", "Asked"), col("delivered", "Delivered"), col("pool", "Via pool"), col("opened", "Opened"), col("dropped", "Leads dropped"), col("cognition", "Cognition"), col("minutes", "Took"), col("ended", "Ended because"), "Focus"]}
          empty="No searches in this window."
          emptyMood="sleeping"
          rows={rows.map((s) => [
            <Link key={s.id} href={`/admin/searches/${s.id}`} className="text-white underline decoration-white/20 underline-offset-2 hover:decoration-coral">{when(s.startedAt)}</Link>,
            <UserLink key="u" id={s.userId} name={s.who} />,
            s.jobsWanted,
            s.delivered,
            s.poolHits || "",
            s.opened ?? "",
            s.dropped,
            s.cognitionUsed != null ? Math.round(Number(s.cognitionUsed)) : "",
            s.endedAt ? `${s.minutes} min` : `running, ${s.minutes} min`,
            <Badge key="e" tone={endTone(s.endReason, !s.endedAt)}>{s.endReason ?? (s.endedAt ? "ended" : "open")}</Badge>,
            <Clamp key="f" text={s.focus} className="max-w-xs" />,
          ])}
        />
        <Cap shown={MAX_ROWS} total={total} />
      </div>
    </Page>
  );
}
