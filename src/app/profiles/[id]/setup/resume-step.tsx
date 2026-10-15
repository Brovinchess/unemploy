"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { FileText, Upload } from "lucide-react";
import { uploadResume, loadSampleResume } from "@/app/actions";
import { FormError } from "@/components/onboarding-shell";

export function ResumeStep({
  profileId,
  submitLabel = "Upload and continue",
  demo = false,
}: {
  profileId: string;
  submitLabel?: string;
  demo?: boolean;
}) {
  const [state, action, pending] = useActionState(uploadResume.bind(null, profileId), undefined);
  const [samplePending, startSample] = useTransition();
  const [fileName, setFileName] = useState<string>();
  const [over, setOver] = useState(false);
  const [dropError, setDropError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  // Replacing a resume stays on the page, so say when it worked.
  const [replaced, setReplaced] = useState(false);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state?.error && demo === false && submitLabel !== "Upload and continue") {
      setReplaced(true);
      setFileName(undefined);
      setTimeout(() => setReplaced(false), 4000);
    }
    wasPending.current = pending;
  }, [pending, state, demo, submitLabel]);
  const timezone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  // A dropped file goes into the real file input, so the form submits it like a chosen one.
  const take = (file: File | undefined) => {
    if (!file) return;
    const ok = /\.(pdf|docx)$/i.test(file.name);
    if (!ok) {
      setDropError("That file isn't a PDF or Word document.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setDropError("That file is over 5 MB.");
      return;
    }
    setDropError(undefined);
    if (input.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.current.files = dt.files;
    }
    setFileName(file.name);
  };

  return (
    <form action={action} className="w-full">
      <label
        htmlFor="resume"
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files?.[0]);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          over ? "border-coral bg-coral/[0.08]" : "border-white/15 bg-white/[0.04] hover:border-mist"
        }`}
      >
        {over ? (
          <>
            <Upload className="size-8 text-coral" aria-hidden />
            <span className="font-display font-bold text-ink">Drop it here</span>
          </>
        ) : fileName ? (
          <>
            <FileText className="size-8 text-coral" aria-hidden />
            <span className="font-semibold">{fileName}</span>
            <span className="text-sm text-muted">Click to choose a different file</span>
          </>
        ) : (
          <>
            <Upload className="size-8 text-mist" aria-hidden />
            <span className="font-display font-bold text-ink">Drop your resume here, or click to choose</span>
            <span className="text-sm text-muted">PDF or Word (.docx), up to 5 MB</span>
          </>
        )}
        <input
          id="resume"
          name="resume"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          ref={input}
          required
          onChange={(e) => take(e.target.files?.[0])}
        />
      </label>
      <p className="mt-3 text-sm text-muted">
        Your resume is stored privately and only shared with your own headhunter.
      </p>
      <input type="hidden" name="timezone" value={timezone} suppressHydrationWarning />
      <FormError message={dropError ?? state?.error} />
      {replaced && <p className="mt-3 text-sm text-white/65" aria-live="polite">Resume replaced. Your headhunter gets it with the next search.</p>}
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
