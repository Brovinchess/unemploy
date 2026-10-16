import { when } from "@/lib/admin";
import { feedbackList } from "@/lib/admin-data";
import { Badge, Clamp, Page, PageHead, Stat, Table, Tiles, UserLink } from "../ui";
import { DoneToggle } from "./done-toggle";

export const dynamic = "force-dynamic";

const KIND_LABEL = { bug: "Bug", idea: "Idea", other: "Other" } as const;
const KIND_TONE = { bug: "rose", idea: "teal", other: "slate" } as const;

// What people sent from the feedback button, newest first. Mark each done once handled.
export default async function FeedbackPage() {
  const { total, open, rows } = await feedbackList();
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
    </Page>
  );
}
