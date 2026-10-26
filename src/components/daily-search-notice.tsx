"use client";

import { useState, useTransition } from "react";
import { Sunrise } from "lucide-react";
import { noticeDailySearch } from "@/app/actions";

// Daily search is on by default from the first search. This strip tells the person once, above
// the cards, in two short lines, with one button. Turning it off lives on the headhunter's page.
export function DailySearchNotice({ profileId, jobs }: { profileId: string; jobs: number }) {
  const [pending, start] = useTransition();
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <section className="rise mb-6 flex flex-col gap-4 rounded-3xl border border-white/[0.06] bg-surface px-5 py-4 sm:flex-row sm:items-center sm:gap-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] text-white/60">
        <Sunrise className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-white">Daily search is on.</p>
        <p className="text-sm text-white/55">
          Your headhunter now looks for {jobs} {jobs === 1 ? "job" : "jobs"} a day by itself. You can turn this off any time on your headhunter&rsquo;s page.
        </p>
      </div>
      <button
        type="button"
        className="btn btn-primary h-9 shrink-0"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await noticeDailySearch(profileId);
            setGone(true);
          })
        }
      >
        Got it
      </button>
    </section>
  );
}
