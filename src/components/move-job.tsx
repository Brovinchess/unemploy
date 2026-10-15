"use client";

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { setJobStatus } from "@/app/actions";
import type { JobStatus } from "@/db/schema";

const OPTIONS: { status: JobStatus; label: string }[] = [
  { status: "saved", label: "To apply" },
  { status: "applied", label: "Applied" },
  { status: "heard_back", label: "Heard back" },
  { status: "interview", label: "Interview" },
  { status: "offer", label: "Offer" },
  { status: "rejected", label: "Rejected" },
  { status: "skipped", label: "Dismissed" },
];

// Change a job's stage in place. A quiet pill, not a form field: most rows never change stage,
// so it shouldn't shout. Our own chevron sits inside with even padding.
export function MoveJob({ jobId, status }: { jobId: string; status: JobStatus }) {
  const [pending, start] = useTransition();
  // Shows the chosen stage at once; the server render catches up a moment later.
  const [value, setValue] = useState(status);
  const [seen, setSeen] = useState(status);
  if (status !== seen) {
    setSeen(status);
    setValue(status);
  }
  return (
    <label className="relative block text-sm">
      <span className="sr-only">Status</span>
      <select
        className="h-8 w-[7.5rem] appearance-none rounded-full border border-white/10 bg-transparent pl-3 pr-8 text-xs text-white/70 outline-none transition-colors hover:border-white/25 hover:text-white focus:border-white/30 disabled:opacity-50"
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as JobStatus;
          setValue(next);
          start(async () => {
            try {
              await setJobStatus(jobId, next);
            } catch {
              setValue(status);
            }
          });
        }}
      >
        {OPTIONS.map((o) => (
          <option key={o.status} value={o.status} className="bg-night-2 text-white">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-white/45" aria-hidden />
    </label>
  );
}
