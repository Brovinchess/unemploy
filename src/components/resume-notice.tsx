import type { ReactNode } from "react";
import { FileWarning } from "lucide-react";
import type { ResumeProblem } from "@/lib/resume-check";

const COPY: Record<ResumeProblem, { title: string; body: string }> = {
  not_resume: {
    title: "This file doesn't look like a resume.",
    body: "Your headhunter reads it to judge which jobs fit you and to write your applications. Upload the CV you would send to an employer.",
  },
  too_thin: {
    title: "Your headhunter has very little to go on.",
    body: "Your resume is only a line or two, so it can't tell which jobs really fit you. Upload your CV, with your recent jobs and skills.",
  },
};

// Shown when the resume a headhunter has isn't really one. The file is never refused; this only
// asks, where the person is, for the real thing.
export function ResumeNotice({ problem, action, compact = false, className = "mb-6" }: { problem: ResumeProblem; action?: ReactNode; compact?: boolean; className?: string }) {
  const { title, body } = COPY[problem];
  // Compact: inside a narrow card (the headhunter's resume section), text only.
  if (compact) {
    return (
      <div className={`rounded-2xl border border-rose/30 bg-rose/[0.06] px-4 py-3 ${className}`}>
        <p className="text-sm text-white">{title}</p>
        <p className="mt-0.5 text-sm text-white/55">{body}</p>
      </div>
    );
  }
  return (
    <section className={`rise flex flex-col gap-4 rounded-3xl border border-white/[0.06] bg-surface px-5 py-4 sm:flex-row sm:items-center sm:gap-5 ${className}`}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-rose/10 text-rose">
        <FileWarning className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-white">{title}</p>
        <p className="text-sm text-white/55">{body}</p>
      </div>
      {action}
    </section>
  );
}
