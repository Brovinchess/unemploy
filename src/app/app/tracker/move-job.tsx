"use client";

import { useTransition } from "react";
import { setJobStatus } from "@/app/actions";
import type { JobStatus } from "@/db/schema";

const OPTIONS: { status: JobStatus; label: string }[] = [
  { status: "saved", label: "Saved" },
  { status: "applied", label: "Applied" },
  { status: "heard_back", label: "Heard back" },
  { status: "interview", label: "Interview" },
  { status: "offer", label: "Offer" },
  { status: "rejected", label: "Rejected" },
];

export function MoveJob({ jobId, status }: { jobId: string; status: JobStatus }) {
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Status</span>
      <select
        className="field min-h-9 w-36 rounded-lg py-1.5 text-sm"
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
    </label>
  );
}
