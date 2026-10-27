import { when } from "@/lib/admin";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { feedbackList } from "@/lib/admin-data";
import { Badge, Clamp, Page, PageHead, Stat, Table, Tiles, UserLink } from "../ui";
import { DoneToggle } from "./done-toggle";

export const dynamic = "force-dynamic";

const KIND_LABEL = { bug: "Bug", idea: "Idea", other: "Other" } as const;
const LEAVE_LABEL: Record<string, string> = {
  found_job: "Found a job", not_looking: "Not looking right now", poor_fit: "Jobs didn't fit", few_jobs: "Too few jobs where they live", slow: "Searches too slow",
  cost: "Costs too much cognition", broken: "Something didn't work", privacy: "Worried about data", other: "Something else",
};
const KIND_TONE = { bug: "rose", idea: "teal", other: "slate" } as const;

// What people sent from the feedback button, newest first. Mark each done once handled.
export default async function FeedbackPage() {
  const { total, open, rows } = await feedbackList();
  // Why people deleted their account, asked on the way out. No names: the account is gone.
  // Empty until migration 0032 has run on this database, rather than breaking the page.
  const left = await db.select().from(schema.accountDeletions).orderBy(desc(schema.accountDeletions.createdAt)).limit(200).catch(() => [] as (typeof schema.accountDeletions.$inferSelect)[]);
  const byReason = Object.entries(left.reduce<Record<string, number>>((a, r) => ((a[r.reason] = (a[r.reason] ?? 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
  return (
    <Page>
      <PageHead section="Feedback" title={`${open} to read`} description="Bugs and ideas people sent from the app, with who and where. Mark each one done once you have looked at it." />
      <Tiles cols={4} className="mt-6">
        <Stat label="Waiting" value={open} />
        <Stat label="Bugs" value={rows.filter((r) => r.kind === "bug").length} />
        <Stat label="Ideas" value={rows.filter((r) => r.kind === "idea").length} />
        <Stat label="All time" value={total} />
      </Tiles>
      <div className="mt-6">
        <Table
          head={["When", "Who", "Kind", "What they said", "Page", ""]}
          empty="Nothing yet. The button sits beside Settings in the app."
          emptyMood="happy"
          rows={rows.map((r) => [
            when(r.createdAt),
            <UserLink key="u" id={r.userId} name={r.username ?? "(no name yet)"} />,
            <Badge key="k" tone={KIND_TONE[r.kind]}>{KIND_LABEL[r.kind]}</Badge>,
            <span key="m" className={`block max-w-xl whitespace-pre-wrap ${r.status === "done" ? "text-white/40" : "text-white"}`}>{r.message}</span>,
            <Clamp key="p" text={r.page} className="max-w-[12rem]" />,
            <DoneToggle key="d" id={r.id} done={r.status === "done"} />,
          ])}
        />
      </div>
      <h2 className="font-display mt-10 text-lg font-medium text-white">Why people left</h2>
      <p className="admin-text-3 mt-1 text-sm">Asked when someone deletes their account. {left.length ? byReason.map(([k, n]) => `${LEAVE_LABEL[k] ?? k} ${n}`).join(" · ") : ""}</p>
      <div className="mt-4">
        <Table
          head={["When", "Reason", "What they said", "Joined", "Country", "Searches", "Jobs", "Kept", "Applied", "Cognition left"]}
          empty="Nobody has deleted their account since this was added."
          emptyMood="happy"
          rows={left.map((r) => [
            when(r.createdAt),
            <Badge key="r" tone={r.reason === "found_job" ? "green" : r.reason === "broken" ? "rose" : "slate"}>{LEAVE_LABEL[r.reason] ?? r.reason}</Badge>,
            <Clamp key="d" text={r.details ?? ""} className="max-w-md" />,
            r.joinedAt ? when(r.joinedAt).slice(0, 10) : "",
            r.country ?? "",
            r.searches,
            r.jobs,
            r.kept,
            r.applied,
            r.balance == null ? "" : Math.round(r.balance),
          ])}
        />
      </div>
    </Page>
  );
}
