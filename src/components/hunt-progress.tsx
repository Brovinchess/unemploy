"use client";

import { Check } from "lucide-react";
import { Ninja } from "./brand";
import { ActivityList, LiveDot, useActivity } from "./activity-feed";

// Shown until the first jobs arrive: what the headhunter has done so far, as steps and
// numbers, next to its full activity timeline.
export function HuntProgress({
  profileId,
  mindName,
  jobsPerDay,
  live,
}: {
  profileId: string;
  mindName: string;
  jobsPerDay: number;
  live: boolean;
}) {
  const data = useActivity(profileId, live);
  const s = data?.stats;

  const steps = [
    { label: "Search request sent", detail: "Your headhunter woke up with your resume and preferences.", done: true },
    { label: "Got to work", detail: "It re-reads your brief and plans the search.", done: !!s && (s.filesRead > 0 || s.replied || s.webSearches > 0) },
    {
      label: "Searching job sites",
      detail: s?.webSearches ? `${s.webSearches} searches so far` : "Looking for open roles that match.",
      done: !!s && s.webSearches > 0 && s.deliveries > 0,
      started: !!s && s.webSearches > 0,
    },
    { label: "Writing your applications", detail: "A cover letter and answers for each job.", done: !!s && s.deliveries > 0 },
    { label: "Jobs on your shortlist", detail: `Up to ${jobsPerDay} checked jobs.`, done: !!s && s.jobsAdded > 0 },
  ];
  const current = steps.findIndex((st) => !st.done);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <section className="rounded-3xl bg-surface p-8 sm:p-10">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <Ninja className="float size-24 shrink-0" />
          <div>
            <p className="flex items-center gap-2 text-sm text-coral">
              {live && <LiveDot />} {live ? "Searching now" : "Paused"}
            </p>
            <h2 className="font-display mt-2 text-3xl font-medium tracking-tight text-white">
              <span className="font-mono text-[0.85em]">{mindName}</span> is finding your jobs
            </h2>
            <p className="mt-2 max-w-lg leading-relaxed text-white/55">
              A search usually takes under an hour. You can close this page; your jobs will be waiting when you come back.
            </p>
          </div>
        </div>

        <ol className="mt-10 space-y-1">
          {steps.map((st, i) => {
            const active = i === current;
            return (
              <li key={st.label} className={`flex items-start gap-4 rounded-2xl px-4 py-3.5 ${active ? "bg-white/[0.04]" : ""}`}>
                <span
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    st.done ? "bg-coral text-white" : active ? "border-2 border-coral text-coral" : "border border-white/15 text-white/40"
                  }`}
                >
                  {st.done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : i + 1}
                </span>
                <div className="flex-1">
                  <p className={`font-medium ${st.done || active ? "text-white" : "text-white/45"}`}>
                    {st.label}
                    {active && <span className="ml-2 text-xs font-normal text-coral">in progress</span>}
                  </p>
                  <p className={`mt-0.5 text-sm ${active || st.done ? "text-white/55" : "text-white/35"}`}>{st.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <dl className="mt-8 grid grid-cols-3 gap-3">
          {[
            { n: s?.webSearches ?? "–", l: "web searches" },
            { n: s?.cognitionUsed ?? "–", l: "cognition used" },
            { n: jobsPerDay, l: "jobs asked for" },
          ].map((x) => (
            <div key={x.l} className="rounded-2xl bg-night-2 px-4 py-4">
              <dt className="sr-only">{x.l}</dt>
              <dd className="font-display text-2xl font-medium text-white">{x.n}</dd>
              <dd className="mt-0.5 text-xs text-white/50">{x.l}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-3xl bg-surface p-6 sm:p-8" aria-label="Headhunter activity">
        <h2 className="font-display flex items-center gap-2.5 text-lg font-medium text-white">
          {live && <LiveDot />} Activity
        </h2>
        <p className="mt-1 text-sm text-white/50">Live from your headhunter. Updates every few seconds.</p>
        <div className="mt-6">
          <ActivityList items={data?.items ?? null} />
        </div>
        {data?.partial && <p className="mt-6 text-xs text-white/40">Some updates from Hello Minds couldn&rsquo;t be loaded just now.</p>}
      </section>
    </div>
  );
}
