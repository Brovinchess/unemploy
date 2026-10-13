"use client";

import { useTransition } from "react";
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
];

// Change a job's stage in place. Our own chevron, so it sits inside the pill with even padding
// instead of the browser's arrow hugging the edge.
export function MoveJob({ jobId, status }: { jobId: string; status: JobStatus }) {
  const [pending, start] = useTransition();
  return (
    <label className="relative block text-sm">
      <span className="sr-only">Status</span>
      <select
        className="field h-9 min-h-0 w-36 appearance-none rounded-full py-0 pl-4 pr-9 text-sm disabled:opacity-50"
        value={status}
        disabled={pending}
        onChange={(e) => start(() => setJobStatus(jobId, e.target.value as JobStatus))}
      >
        {OPTIONS.map((o) => (
          <option key={o.status} value={o.status}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-white/50" aria-hidden />
    </label>
  );
}
