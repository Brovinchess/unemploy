"use client";

import { useState, useTransition } from "react";
import { Sunrise } from "lucide-react";
import { setMorningSearch } from "@/app/actions";
import { estimateSearchCost, MAX_JOBS_PER_SEARCH } from "@/lib/preferences";

// A switch on the headhunter's page: search every morning for a chosen number of jobs. The cost
// line keeps the daily spend in view; the switch turns itself off when the balance runs out.
export function MorningSearch({
  profileId,
  jobs: initial,
  defaultJobs,
  perJob,
  extraPlaces = 0,
  email,
  disabled,
}: {
  profileId: string;
  jobs: number | null; // null when off
  defaultJobs: number;
  perJob?: number;
  extraPlaces?: number;
  email: string | null; // where the day's emails go, if any
  disabled?: string; // why it can't be turned on
}) {
  const [on, setOn] = useState(initial != null);
  const [jobs, setJobs] = useState(initial ?? Math.min(defaultJobs, 3));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const save = (next: number | null) =>
    start(async () => {
      const r = await setMorningSearch(profileId, next);
      setError(r?.error);
      if (r?.error) setOn(initial != null);
    });
  const perDay = estimateSearchCost(jobs, perJob, extraPlaces).cognition;

  return (
    <section id="morning" className="rise rise-2 mt-6 scroll-mt-8 rounded-3xl bg-surface px-6 py-5">
      <label className="flex cursor-pointer items-start gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] text-white/60">
          <Sunrise className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-4">
            <span className="block text-white">Search every morning</span>
            <input
              type="checkbox"
              className="size-5 shrink-0 accent-[var(--coral)]"
              checked={on}
              disabled={pending || (!on && !!disabled)}
              onChange={(e) => {
                const v = e.target.checked;
                setOn(v);
                save(v ? jobs : null);
              }}
            />
          </span>
          <span className="mt-1 block text-sm text-white/50">
            {on ? (
              <>
                Runs at 9am your time for{" "}
                <select
                  className="mx-1 rounded-lg bg-night-2 px-2 py-0.5 text-white"
                  value={jobs}
                  disabled={pending}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setJobs(v);
                    save(v);
                  }}
                  aria-label="Jobs each day"
                >
                  {Array.from({ length: MAX_JOBS_PER_SEARCH }, (_, i) => i + 1).map((v) => (
                    <option key={v} value={v}>
                      {v} {v === 1 ? "job" : "jobs"}
                    </option>
                  ))}
                </select>{" "}
                a day. If the morning falls short, it searches once more three hours later, wider.
              </>
            ) : disabled ? (
              disabled
            ) : (
              `Finds a set number of jobs each day without you pressing anything. About ${perDay} cognition a day for ${jobs} ${jobs === 1 ? "job" : "jobs"}.`
            )}
          </span>
          {on && (
            <span className="mt-1 block text-sm text-white/40">
              About {perDay} cognition a day, more on a day with a second search. Stops by itself when the balance runs out.
              {email ? ` Results go to ${email}.` : " Add an email in Settings to get the results each morning."}
            </span>
          )}
          {error && <span className="mt-2 block text-sm text-rose">{error}</span>}
        </span>
      </label>
    </section>
  );
}
