import { when } from "@/lib/admin";
import { briefs } from "@/lib/admin-data";
import { BRIEF_VERSION } from "@/lib/brief";
import { Badge, Card, Page, PageHead, UserLink, hhTone } from "../ui";

export const dynamic = "force-dynamic";

// The exact text each headhunter works from, built live from its settings. The key is hidden.
// A headhunter on an older brief version gets this full text with its next search request.
export default async function Briefs() {
  const rows = await briefs();
  return (
    <Page>
      <PageHead section="Briefs" title={`${rows.length} briefs`} description={`What each headhunter is told, word for word, as it would be sent today (brief version ${BRIEF_VERSION}). The search request under each is what every "Find new jobs" adds.`} />
      <div className="mt-6 space-y-6">
        {rows.map((r) => (
          <Card
            key={r.id}
            title={
              <span className="flex flex-wrap items-center gap-2">
                <UserLink id={r.userId} name={r.username ?? "(no name yet)"} />
                <span className="admin-text-3">· {r.label}</span>
                {r.mindName && <span className="admin-text-3 font-mono text-sm">{r.mindName}</span>}
                <Badge tone={hhTone(r.status)}>{r.status.replace(/_/g, " ")}</Badge>
                <Badge tone={r.briefVersion >= BRIEF_VERSION ? "green" : "amber"}>{r.briefVersion >= BRIEF_VERSION ? `has v${r.briefVersion}` : `on v${r.briefVersion}, gets v${BRIEF_VERSION} next search`}</Badge>
              </span>
            }
            hint={`Briefed ${when(r.briefedAt) || "never"}`}
          >
            <details className="group">
              <summary className="cursor-pointer text-sm text-white/70 hover:text-white">Brief, {r.text.split(/\s+/).length} words</summary>
              <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-black/30 p-4 font-mono text-[12.5px] leading-relaxed text-white/80">{r.text}</pre>
            </details>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-white/70 hover:text-white">Search request, {r.request.split(/\s+/).length} words</summary>
              <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-black/30 p-4 font-mono text-[12.5px] leading-relaxed text-white/80">{r.request}</pre>
            </details>
          </Card>
        ))}
      </div>
    </Page>
  );
}
