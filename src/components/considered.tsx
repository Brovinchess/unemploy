import { and, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import type { DropReason } from "@/db/schema";

const LABELS: Record<DropReason, string> = {
  not_eligible: "not hireable from your country",
  too_old: "posted too long ago",
  closed: "already closed",
  poor_fit: "you miss most must-haves",
  duplicate: "already sent",
  pay: "below your pay floor",
  work_setting: "wrong work setting",
  other: "other",
};

// Advice when one reason dominates: the rule the user could loosen, in plain words.
function advice(counts: Map<DropReason, number>, total: number, country: string, remoteOnly: boolean) {
  const share = (r: DropReason) => (counts.get(r) ?? 0) / Math.max(1, total);
  if (share("not_eligible") >= 0.5) {
    return remoteOnly
      ? `Most of what it found was only open to other countries. Adding hybrid or on-site roles in ${country} would widen the pool.`
      : `Most of what it found was only open to other countries. Adding more job titles under "Looking for" gives it more to choose from.`;
  }
  if (share("too_old") >= 0.4) return "Many postings were just over your posting age limit. Raising \"Posted within\" to 60 days would let them through.";
  if (share("pay") >= 0.4) return "Many jobs paid below your floor. Lowering it a little would widen the pool.";
  return null;
}

// What the headhunter looked at in its latest search and why it dropped what it dropped.
export async function Considered({ profileId, country, remoteOnly }: { profileId: string; country: string; remoteOnly: boolean }) {
  const latest = await db.query.searches.findFirst({ where: eq(schema.searches.profileId, profileId), orderBy: desc(schema.searches.startedAt) });
  if (!latest) return null;
  const rows = await db.query.leads.findMany({
    where: and(eq(schema.leads.profileId, profileId), gte(schema.leads.createdAt, latest.startedAt)),
    orderBy: desc(schema.leads.createdAt),
    limit: 200,
  });
  const sent = latest.jobsAdded ?? 0;
  if (!rows.length) {
    return (
      <section className="rounded-3xl bg-surface p-6">
        <h2 className="font-display text-lg font-medium text-white">Why jobs were dropped</h2>
        <p className="mt-3 text-sm text-white/45">
          After its next search, every job it checked and dropped shows here with the reason.
        </p>
      </section>
    );
  }
  const counts = new Map<DropReason, number>();
  for (const r of rows) counts.set(r.reason, (counts.get(r.reason) ?? 0) + 1);
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const tip = advice(counts, rows.length, country, remoteOnly);

  return (
    <section className="rounded-3xl bg-surface p-6">
      <h2 className="font-display text-lg font-medium text-white">Why jobs were dropped</h2>
      <p className="mt-1 text-sm text-white/50">
        Latest search: checked <b className="text-white">{rows.length + sent}</b>, sent <b className="text-white">{sent}</b>, dropped{" "}
        <b className="text-white">{rows.length}</b>.
      </p>
      <ul className="mt-4 space-y-1.5">
        {ordered.map(([reason, n]) => (
          <li key={reason} className="flex items-center gap-3 text-sm">
            <span className="w-8 text-right font-medium text-white">{n}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <span className="block h-full rounded-full bg-coral" style={{ width: `${Math.max(4, (n / rows.length) * 100)}%` }} />
            </span>
            <span className="w-52 text-white/60">{LABELS[reason]}</span>
          </li>
        ))}
      </ul>
      {tip && <p className="mt-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm text-white/80">{tip}</p>}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-white/45 hover:text-white">Show the list</summary>
        <ul className="mt-2 divide-y divide-white/[0.06] text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-4 py-2">
              <span className="min-w-0">
                <span className="block truncate text-white">{r.company} · {r.title}</span>
                {r.note && <span className="block truncate text-xs text-white/40">{r.note}</span>}
              </span>
              <span className="shrink-0 text-xs text-white/45">{LABELS[r.reason]}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
