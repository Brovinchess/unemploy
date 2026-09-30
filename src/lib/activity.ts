import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Profile, User } from "@/db/schema";
import type { Rejection } from "./ingest";
import { minds, type ToolUse } from "./minds/client";

// A plain-English timeline of what a headhunter has been doing, merged from three
// sources: its chat replies, the Hello Minds spending ledger (hourly, per tool) and our
// own log of every job delivery.

export type ActivityItem = {
  id: string;
  at: string; // ISO
  kind: "brief" | "said" | "work" | "delivery" | "test";
  title: string;
  detail?: string;
};

export type ActivityStats = {
  replied: boolean; // the Mind has said something since the brief
  webSearches: number;
  filesRead: number;
  cognitionUsed: number;
  deliveries: number;
  jobsAdded: number;
};

const WINDOW_MS = 3 * 86_400_000;

const REJECTION_LABELS: Record<string, string> = {
  duplicate: "already sent",
  stale_posting: "posting too old",
  found_by_other_headhunter: "found by your other headhunter",
  job_link_dead: "dead link",
  job_closed: "posting closed",
  not_employer_link: "job board copy, not the employer's page",
  not_verified: "not checked open today",
  not_eligible: "can't apply from your country",
  poor_fit: "misses most must-haves",
  company_limit: "too many from one company",
  daily_limit: "over your daily limit",
  claim_not_in_resume: "claim not in your resume",
  wrong_country: "wrong country",
  work_setting_not_wanted: "work setting you didn't pick",
  company_avoided: "company you avoid",
  bad_url: "bad link",
  bad_job: "incomplete details",
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function describeWork(uses: ToolUse[]): string {
  const calls = (tool: string) => uses.filter((u) => u.tool === tool).reduce((a, u) => a + u.calls, 0);
  const parts: string[] = [];
  const web = calls("SEARCH_Web");
  if (web) parts.push(`searched the web ${plural(web, "time")}`);
  const x = calls("SEARCH_X");
  if (x) parts.push(`searched X ${plural(x, "time")}`);
  const files = calls("FILE_Analyze");
  if (files) parts.push(`read ${files === 1 ? "a file" : `${files} files`}`);
  const pages = calls("HTTP_Execute");
  if (pages) parts.push(`opened ${plural(pages, "page")}`);
  const code = calls("LLM_CodeInterpreter");
  if (code) parts.push("ran some code");
  if (!parts.length) parts.push("thought things through");
  const s = parts.join(", ");
  return s[0].toUpperCase() + s.slice(1);
}

function describeOwnMessage(text: string, first: boolean) {
  if (text.startsWith("This replaces my earlier brief")) return "Your updated preferences were sent";
  if (text.includes("updated my resume")) return "Your new resume was sent";
  if (first || text.includes("/api/ingest")) return "Your brief and resume were sent";
  return "Career Ninja sent a note";
}

export async function buildActivity(
  user: User,
  profile: Profile,
): Promise<{ items: ActivityItem[]; stats: ActivityStats; partial: boolean }> {
  const since = new Date(Math.max(profile.briefedAt?.getTime() ?? 0, Date.now() - WINDOW_MS) - 60_000);
  // The ledger is bucketed by hour, so ask from the start of the hour the window opens in.
  const usageSince = new Date(since);
  usageSince.setUTCMinutes(0, 0, 0);
  const api = minds(user);
  const items: ActivityItem[] = [];
  let partial = false;

  const [chat, usage, deliveries] = await Promise.all([
    profile.conversationAlias ? api.history(profile.conversationAlias, 40).catch(() => ((partial = true), [])) : [],
    profile.mindId ? api.toolUsage(profile.mindId, usageSince).catch(() => ((partial = true), [])) : [],
    db
      .select()
      .from(schema.ingestLog)
      .where(and(eq(schema.ingestLog.profileId, profile.id), gte(schema.ingestLog.createdAt, since)))
      .orderBy(desc(schema.ingestLog.createdAt))
      .limit(30),
  ]);

  const oldestOwn = [...chat].reverse().find((m) => !m.fromMind);
  chat.forEach((m, i) => {
    if (m.at < since || !m.text.trim()) return;
    items.push(
      m.fromMind
        ? { id: `c${i}`, at: m.at.toISOString(), kind: "said", title: `${profile.mindName ?? "Your headhunter"} said`, detail: m.text.trim().slice(0, 400) }
        : { id: `c${i}`, at: m.at.toISOString(), kind: "brief", title: describeOwnMessage(m.text, m === oldestOwn) },
    );
  });

  const byHour = new Map<string, ToolUse[]>();
  for (const u of usage) {
    if (!u.calls && !u.cognition) continue;
    const k = u.at.toISOString();
    byHour.set(k, [...(byHour.get(k) ?? []), u]);
  }
  for (const [hour, uses] of byHour) {
    const spent = uses.reduce((a, u) => a + u.cognition, 0);
    // Place each hour's work at the end of that hour (or now, for the current one).
    const at = new Date(Math.min(new Date(hour).getTime() + 3_600_000 - 1000, Date.now())).toISOString();
    items.push({ id: `w${hour}`, at, kind: "work", title: describeWork(uses), detail: `Used ${Math.round(spent)} cognition in this hour` });
  }

  for (const d of deliveries) {
    const rejected = (d.detail as Rejection[] | null) ?? [];
    if (d.dryRun) {
      items.push({ id: `d${d.id}`, at: d.createdAt.toISOString(), kind: "test", title: "Tested its connection to Career Ninja" });
      continue;
    }
    const reasons = new Map<string, number>();
    for (const r of rejected) {
      const label = REJECTION_LABELS[r.code] ?? "other";
      reasons.set(label, (reasons.get(label) ?? 0) + 1);
    }
    const why = [...reasons].map(([label, n]) => `${n} ${label}`).join(", ");
    items.push({
      id: `d${d.id}`,
      at: d.createdAt.toISOString(),
      kind: "delivery",
      title: `Sent ${plural(d.accepted + d.rejected, "job")}`,
      detail: [`${d.accepted} added to your shortlist`, why && `${d.rejected} left out: ${why}`].filter(Boolean).join(" · "),
    });
  }

  const sum = (tool: string) => usage.filter((u) => u.tool === tool).reduce((a, u) => a + u.calls, 0);
  const real = deliveries.filter((d) => !d.dryRun);
  const stats: ActivityStats = {
    replied: chat.some((m) => m.fromMind && m.at >= since),
    webSearches: sum("SEARCH_Web"),
    filesRead: sum("FILE_Analyze"),
    cognitionUsed: Math.round(usage.reduce((a, u) => a + u.cognition, 0)),
    deliveries: real.length,
    jobsAdded: real.reduce((a, d) => a + d.accepted, 0),
  };

  items.sort((a, b) => b.at.localeCompare(a.at));
  return { items: items.slice(0, 25), stats, partial };
}
