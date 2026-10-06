"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Ninja } from "./brand";
import { ActivityList, LiveDot, useActivity } from "./activity-feed";

// What the headhunter last said during this search, without its "SEARCH REQUEST #3 - progress:"
// preamble, and the most jobs it has said it checked ("4 roles fully verified"). Its own
// words, so the bar matches the activity log even before any job is sent.
function fromMessages(items: { kind: string; at: string; detail?: string }[], since: string | null) {
  const said = items.filter((i) => i.kind === "said" && i.detail && (!since || i.at >= since));
  const latest = said[0];
  const text = latest?.detail
    ?.replace(/^\s*search request\s*#?\d*[^:]*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const line = text ? (text.match(/^.+?[.!?](\s|$)/)?.[0] ?? text).trim().slice(0, 140) : null;
  let checked = 0;
  for (const s of said) {
    for (const m of s.detail!.matchAll(/(\d+)\s+(?:[\w-]+\s+){0,3}?(?:roles?|jobs?|candidates?|postings?)\s+(?:[\w-]+\s+){0,2}?(?:verified|vetted|checked|pass(?:ed|ing)?|ready)/gi)) {
      checked = Math.max(checked, Number(m[1]));
    }
    for (const m of s.detail!.matchAll(/(\d+)\s+(?:[\w-]+\s+){0,2}?(?:verified|vetted|checked)\s+(?:roles?|jobs?|candidates?|postings?)|(?:^|[\s;,(])(\d+)\s+(?:verified|vetted)\b/gi)) {
      checked = Math.max(checked, Number(m[1] ?? m[2]));
    }
  }
  const forms = said.some((s) => /application form|form question|form captur|forms? (?:read|captured)/i.test(s.detail!));
  return { line, at: latest?.at ?? null, checked, forms };
}

// A search in progress, as one compact bar: "Searching… found 3 of 20" with a progress
// bar. The steps and the headhunter's activity log open underneath on request.
export function HuntProgress({
  profileId,
  mindName,
  jobsPerDay,
  live,
  startedAt = null,
}: {
  profileId: string;
  mindName: string;
  jobsPerDay: number;
  live: boolean;
  startedAt?: string | null;
}) {
  const data = useActivity(profileId, live);
  const [open, setOpen] = useState(false);
  const s = data?.stats;
  const found = s?.jobsAdded ?? 0;

  const said = fromMessages(data?.items ?? [], startedAt);
  const sent = !!s && s.deliveries > 0;
  const raw = [
    { label: "Search request sent", done: true },
    { label: "Reading your brief", done: !!s && (s.filesRead > 0 || s.replied || s.webSearches > 0) },
    { label: "Searching job sites", done: !!s && s.webSearches > 0 && (sent || said.checked > 0), detail: s?.webSearches ? `${s.webSearches} searches` : undefined },
    { label: "Checking jobs", done: sent || said.checked > 0, detail: said.checked ? `${said.checked} passed` : undefined },
    { label: "Reading application forms", done: sent, detail: said.forms ? "copying each form's questions" : undefined },
    { label: "Writing your applications", done: sent },
    { label: "Jobs on your shortlist", done: found > 0, detail: found ? `${found} so far` : undefined },
  ];
  // A later step done means the earlier ones are too (usage numbers can lag behind).
  const last = raw.map((st) => st.done).lastIndexOf(true);
  const steps = raw.map((st, i) => ({ ...st, done: i <= last }));
  const current = steps.findIndex((st) => !st.done);
  const now = steps[current === -1 ? steps.length - 1 : current];
  const waiting = Math.max(0, said.checked - found);

  return (
    <section className="mb-6 rounded-3xl bg-surface" aria-label="Search progress">
      <div className="flex items-center gap-4 px-5 py-4 sm:px-6">
        <Ninja mood={live ? "searching" : "sleeping"} className="size-11 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p className="flex items-center gap-2 font-medium text-white">
              {live && <LiveDot />}
              {live ? "Searching…" : "Paused"}
              <span className="text-white/55">
                found <b className="font-semibold text-white">{found}</b> of {jobsPerDay}
              </span>
              {waiting > 0 && <span className="text-xs font-normal text-coral">· {waiting} more checked, not sent yet</span>}
            </p>
            <p className="truncate text-xs text-white/45">
              {current === -1 && live ? "Finding more jobs" : now.label}
              {s ? ` · ${s.cognitionUsed} cognition used` : ""}
            </p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-valuemin={0} aria-valuemax={jobsPerDay} aria-valuenow={found}>
            <div
              className={`h-full rounded-full bg-coral transition-[width] duration-700 ${found === 0 && live ? "w-1/12 animate-pulse" : ""}`}
              style={found ? { width: `${Math.max(4, Math.min(100, (found / jobsPerDay) * 100))}%` } : undefined}
            />
          </div>

        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs text-white/55 hover:bg-white/[0.06] hover:text-white"
        >
          Details <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </div>

      {open && (
        <div className="grid gap-6 border-t border-white/[0.06] px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div>
            <p className="text-sm text-white/55">
              <span className="font-mono text-white/80">{mindName}</span> is on it. A careful search can take a few hours; you can
              close this page and jobs will appear as they&rsquo;re sent.
            </p>
            <ol className="mt-4 space-y-2.5">
              {steps.map((st, i) => {
                const active = i === current;
                return (
                  <li key={st.label} className="flex items-center gap-3 text-sm">
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                        st.done ? "bg-coral text-white" : active ? "border-2 border-coral text-coral" : "border border-white/15 text-white/40"
                      }`}
                    >
                      {st.done ? <Check className="size-3" strokeWidth={3} aria-hidden /> : i + 1}
                    </span>
                    <span className={st.done || active ? "text-white" : "text-white/40"}>{st.label}</span>
                    {st.detail && <span className="text-xs text-white/40">{st.detail}</span>}
                    {active && <span className="text-xs text-coral">in progress</span>}
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 flex items-center gap-3 text-sm text-white/40">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed border-white/20 text-[10px]">+</span>
              After the search: your personal Mind answers the form questions (see Answers)
            </p>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-white/35">Activity</p>
            <ActivityList items={data?.items ?? null} limit={8} compact />
            {data?.partial && <p className="mt-4 text-xs text-white/40">Some updates from Hello Minds couldn&rsquo;t be loaded just now.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
