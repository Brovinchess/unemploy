"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Sunrise } from "lucide-react";
import { noticeDailySearch, setMorningSearch } from "@/app/actions";

// Daily search is on by default from the first search. This strip says so once, above the cards,
// with what it costs and the way out, and goes away when the person answers it.
export function DailySearchNotice({ profileId, jobs, perDay, href }: { profileId: string; jobs: number; perDay: number; href: string }) {
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
          Your headhunter looks for {jobs} {jobs === 1 ? "job" : "jobs"} a day on its own, about {perDay} cognition a day. Turn it off any time.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-primary h-9"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await noticeDailySearch(profileId);
              setGone(true);
            })
          }
        >
          Keep it
        </button>
        <Link href={href} className="text-sm text-white/60 hover:text-white" onClick={() => start(async () => { await noticeDailySearch(profileId); })}>
          Change
        </Link>
        <button
          type="button"
          className="text-sm text-white/60 hover:text-rose"
          disabled={pending}
          onClick={() => {
            if (!confirm("Turn off daily search? You can turn it back on from your headhunter's page.")) return;
            start(async () => {
              await setMorningSearch(profileId, null);
              setGone(true);
            });
          }}
        >
          Turn off
        </button>
      </div>
    </section>
  );
}
