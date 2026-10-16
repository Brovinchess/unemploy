import { sortParams, when } from "@/lib/admin";
import { users } from "@/lib/admin-data";
import { Badge, Cap, Check, ClearLink, FilterForm, Page, PageHead, SortLink, Table, TextInput, UserLink, hhTone } from "../ui";

const BASE = "/admin/users";
const MAX_ROWS = 500;

export default async function Users({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const { key, dir } = sortParams(q, "joined");
  const { total, allUsers, deployedUsers, unnamed, rows } = await users({
    q: q.q || undefined,
    deployed: !!q.deployed,
    active: q.active ? Math.max(1, Number(q.active) || 7) : undefined,
    idle: !!q.idle,
    nokeep: !!q.nokeep,
    sort: key,
    dir,
  });
  const col = (k: string, label: string) => <SortLink k={k} label={label} base={BASE} q={q} sort={key} dir={dir} />;
  const filtered = !!(q.q || q.deployed || q.active || q.idle || q.nokeep);

  return (
    <Page>
      <PageHead
        section="Users"
        title={`${total} accounts`}
        description={`${allUsers} in total. ${deployedUsers} deployed a headhunter. ${unnamed} never finished the name step.`}
        controls={
          <FilterForm q={q}>
            <TextInput name="q" value={q.q} placeholder="Username or email" />
            <TextInput name="active" value={q.active} placeholder="Searched in last N days" size={20} />
            <Check name="deployed" checked={!!q.deployed} label="Deployed" />
            <Check name="idle" checked={!!q.idle} label="Deployed, never searched" />
            <Check name="nokeep" checked={!!q.nokeep} label="Searched, kept nothing" />
            {filtered && <ClearLink href={BASE} />}
          </FilterForm>
        }
      />
      <div className="mt-6">
        <Table
          head={[
            col("name", "User"), col("joined", "Joined"), col("email", "Email"), col("status", "Headhunter"), col("searches", "Searches"), col("jobs", "Jobs"), col("kept", "Kept"), col("applied", "Applied+"),
            col("cognition", "Cognition"), col("lastSearch", "Last search"), col("lastSeen", "Last seen"), col("extension", "Extension"), col("referrer", "Referred by"), col("waiting", "Questions waiting"), col("answers", "Saved answers"),
          ]}
          empty="No accounts match these filters."
          rows={rows.map((r) => [
            <UserLink key={r.id} id={r.id} name={r.name} />,
            when(r.createdAt).slice(0, 10),
            r.email ? (
              <span key="e" title={r.email}>
                {r.email.length > 28 ? `${r.email.slice(0, 26)}…` : r.email} <span className={r.emailVerified ? "text-emerald-300" : "text-white/35"}>{r.emailVerified ? "✓" : "unverified"}</span>
              </span>
            ) : (
              ""
            ),
            r.hhStatus ? <Badge key="h" tone={hhTone(r.hhRaw)}>{r.hhStatus}</Badge> : <span key="n" className="text-white/30">none</span>,
            r.searches,
            r.jobs,
            r.kept,
            r.applied,
            r.cognition,
            when(r.lastSearch),
            when(r.lastSeen),
            r.extension ? `yes${r.extensionUsed ? `, ${when(r.extensionUsed).slice(0, 10)}` : ""}` : <span key="x" className="text-white/30">no</span>,
            r.referrerId ? <UserLink key="r" id={r.referrerId} name={r.referrer} /> : r.referrer,
            r.waiting ? <Badge key="w" tone="amber">{r.waiting}</Badge> : <span key="w" className="text-white/25">0</span>,
            r.answers || <span key="a" className="text-white/25">0</span>,
          ])}
        />
        <Cap shown={MAX_ROWS} total={total} />
      </div>
    </Page>
  );
}
