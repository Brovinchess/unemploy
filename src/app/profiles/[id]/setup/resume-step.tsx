"use client";

import { useActionState, useState, useTransition } from "react";
import { FileText, Upload } from "lucide-react";
import { copyResume, uploadResume, loadSampleResume } from "@/app/actions";
import { FormError } from "@/components/onboarding-shell";

export function ResumeStep({
  profileId,
  submitLabel = "Upload and continue",
  demo = false,
  reuse,
}: {
  profileId: string;
  submitLabel?: string;
  demo?: boolean;
  reuse?: { fromId: string; label: string; fileName: string };
}) {
  const [state, action, pending] = useActionState(uploadResume.bind(null, profileId), undefined);
  const [samplePending, startSample] = useTransition();
  const [fileName, setFileName] = useState<string>();

  return (
    <form action={action} className="w-full">
      {reuse && (
        <div className="mb-6">
          <button
            type="button"
            className="flex w-full items-center gap-4 rounded-2xl bg-night-2 px-5 py-4 text-left hover:bg-white/[0.06]"
            disabled={samplePending}
            onClick={() => startSample(() => copyResume(profileId, reuse.fromId))}
          >
            <FileText className="size-6 shrink-0 text-coral" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-white">{samplePending ? "Copying…" : `Use the same resume as ${reuse.label}`}</span>
              <span className="block truncate text-sm text-white/50">{reuse.fileName}</span>
            </span>
          </button>
          <p className="mt-6 text-center text-sm text-white/40">or upload a different one for this headhunter</p>
        </div>
      )}
      <label
        htmlFor="resume"
        className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.04] px-6 py-12 text-center transition-colors hover:border-mist"
      >
        {fileName ? (
          <>
            <FileText className="size-8 text-coral" aria-hidden />
            <span className="font-semibold">{fileName}</span>
            <span className="text-sm text-muted">Click to choose a different file</span>
          </>
        ) : (
          <>
            <Upload className="size-8 text-mist" aria-hidden />
            <span className="font-display font-bold text-ink">Choose your resume</span>
            <span className="text-sm text-muted">PDF or Word (.docx), up to 5 MB</span>
          </>
        )}
        <input
          id="resume"
          name="resume"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          required
          onChange={(e) => setFileName(e.target.files?.[0]?.name)}
        />
      </label>
      <p className="mt-3 text-sm text-muted">
        Your resume is stored privately and only shared with your own headhunter.
      </p>
      <FormError message={state?.error} />
      <button className="btn btn-primary mt-8 h-12 w-full" disabled={pending || !fileName}>
        {pending ? "Reading your resume…" : submitLabel}
      </button>
      {demo && (
        <p className="mt-6 text-center text-sm text-muted">
          Demo mode:{" "}
          <button
            type="button"
            className="underline decoration-mist underline-offset-4 hover:text-navy"
            disabled={samplePending}
            onClick={() => startSample(() => loadSampleResume(profileId))}
          >
            use a sample resume instead
          </button>
        </p>
      )}
    </form>
  );
}
