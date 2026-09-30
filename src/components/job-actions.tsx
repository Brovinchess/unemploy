"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, ExternalLink, X } from "lucide-react";
import { setJobStatus } from "@/app/actions";
import type { JobStatus } from "@/db/schema";

const SKIP_REASONS = [
  "Too junior",
  "Too senior",
  "Wrong location",
  "Salary too low",
  "Not interested in this company",
  "Not my kind of role",
];

export function JobActions({
  jobId,
  url,
  status,
  doneHref,
}: {
  jobId: string;
  url: string;
  status: JobStatus;
  doneHref: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [opened, setOpened] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const act = (s: JobStatus, reason?: string, next = false) =>
    start(async () => {
      await setJobStatus(jobId, s, reason);
      if (next) router.push(doneHref, { scroll: false });
    });

  if (skipping) {
    return (
      <div className="mt-5 rounded-xl bg-canvas p-4">
        <p className="font-medium">Why skip this one? Your headhunter learns from it.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SKIP_REASONS.map((r) => (
            <button key={r} className="chip min-h-9 text-sm" disabled={pending} onClick={() => act("skipped", r, true)}>
              {r}
            </button>
          ))}
          <button className="btn btn-sm text-muted hover:text-ink" onClick={() => setSkipping(false)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (opened) {
    return (
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-canvas p-4">
        <p className="mr-auto font-medium">Did you send your application?</p>
        <button className="btn btn-sm btn-accent" disabled={pending} onClick={() => act("applied", undefined, true)}>
          Yes, I applied
        </button>
        <button className="btn btn-sm btn-ghost" onClick={() => setOpened(false)}>
          Not yet
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-accent" onClick={() => setOpened(true)}>
        Apply on their site <ExternalLink className="size-4" aria-hidden />
      </a>
      {status === "new" && (
        <button className="btn btn-ghost" disabled={pending} onClick={() => act("saved")}>
          <Bookmark className="size-4" aria-hidden /> Save
        </button>
      )}
      <button className="btn btn-ghost" disabled={pending} onClick={() => setSkipping(true)}>
        <X className="size-4" aria-hidden /> Skip
      </button>
    </div>
  );
}
