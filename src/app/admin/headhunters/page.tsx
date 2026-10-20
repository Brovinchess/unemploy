import Link from "next/link";
import { ratio, sortParams, when } from "@/lib/admin";
import { headhunters } from "@/lib/admin-data";
import { Badge, Clamp, ClearLink, FilterForm, Page, PageHead, Select, SortLink, Table, TextInput, UserLink, hhTone } from "../ui";
import { RerunShort, RunOne } from "./run-buttons";

const BASE = "/admin/headhunters";
const STATUSES = ["draft", "needs_resume", "needs_preferences", "needs_topup", "hunting", "paused"];

export default async function Headhunters({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const { key, dir } = sortParams(q, "lastSearch");
  const { total, deployed, hunting, paused, rows } = await headhunters({ status: q.status || undefined, user: q.user || undefined, sort: key, dir });
  const col = (k: string, label: string) => <SortLink k={k} label={label} base={BASE} q={q} sort={key} dir={dir} />;

  return (
    <Page>
      <PageHead
        section="Headhunters"
        title={`${total} headhunters`}
        description={`${deployed} deployed, ${hunting} hunting, ${paused} paused.`}
        controls={
          <>
            <RerunShort />
            <FilterForm q={q}>
              <TextInput name="user" value={q.user} placeholder="User" size={14} />
              <Select name="status" value={q.status} blank="Any status" options={STATUSES.map((s) => [s, s.replace(/_/g, " ")])} />
              {(q.status || q.user) && <ClearLink href={BASE} />}
            </FilterForm>
          </>
        }
      />
      <div className="mt-6">
        <Table
          head={[
            col("user", "User"), col("label", "Label"), col("mind", "Mind name"), col("status", "Status"), col("roles", "Roles"), col("place", "Place"), col("settings", "Work settings"),
            col("perSearch", "Jobs / search"), col("age", "Posting age"), col("searches", "Searches"), col("jobs", "Jobs"), col("jobsPerSearch", "Jobs per search"),
            col("avgMinutes", "Avg min / search"), col("perJob", "Cognition / job"), col("lastSearch", "Last search"), col("lastDelivery", "Last delivery"), "",
          ]}
          empty="No headhunters match these filters."
          rows={rows.map((r) => [
            <UserLink key={r.id} id={r.userId} name={r.user} />,
            r.label,
            r.mindName ?? "",
            <Badge key="st" tone={hhTone(r.status)}>{r.status.replace(/_/g, " ")}</Badge>,
            <Clamp key="r" text={r.roles} className="max-w-56" />,
            r.place,
            r.settings,
            r.perSearch ?? "",
            r.age ? `${r.age}d` : "",
            r.searches ? <Link key="s" href={`/admin/searches?days=365&user=${encodeURIComponent(r.user)}`} className="underline decoration-white/20 underline-offset-2 hover:text-white">{r.searches}</Link> : 0,
            r.jobs ? <Link key="j" href={`/admin/jobs?days=365&user=${encodeURIComponent(r.user)}`} className="underline decoration-white/20 underline-offset-2 hover:text-white">{r.jobs}</Link> : 0,
            r.jobsPerSearch != null ? ratio(r.jobs, r.searches) : "",
            r.avgMinutes ?? "",
            r.perJob != null ? Math.round(r.perJob) : "",
            when(r.lastSearch),
            when(r.lastDeliveryAt),
            <RunOne key="run" profileId={r.id} disabled={r.status !== "hunting"} />,
          ])}
        />
      </div>
    </Page>
  );
}
