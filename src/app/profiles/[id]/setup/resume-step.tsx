"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { FileText, PencilLine, Upload } from "lucide-react";
import { uploadResume, loadSampleResume } from "@/app/actions";
import { FormError } from "@/components/onboarding-shell";
import { QuickProfileStep } from "./quick-profile-step";

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
  // First-time setup offers a second way in: a few blanks instead of a file.
  const firstTime = submitLabel === "Upload and continue";
  const [mode, setMode] = useState<"upload" | "blanks">("upload");
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

  const choice = firstTime && (
    <div className="mb-6 grid gap-3 sm:grid-cols-2">
      {(
        [
          ["upload", Upload, "I have a resume", "PDF or Word. The best start."],
          ["blanks", PencilLine, "I don't have one", "Fill in a few blanks instead. Two minutes."],
        ] as const
      ).map(([m, Icon, label, hint]) => {
        const on = mode === m;
        return (
          <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={on} className={`flex items-center gap-3 rounded-2xl p-4 text-left transition-colors ${on ? "bg-coral/15 ring-2 ring-coral" : "bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/[0.07]"}`}>
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${on ? "bg-coral text-white" : "bg-white/[0.08] text-white/70"}`}>
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-medium text-white">{label}</span>
              <span className="block text-sm text-white/50">{hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
  if (mode === "blanks") {
    return (
      <div className="w-full">
        {choice}
        <QuickProfileStep profileId={profileId} />
      </div>
    );
  }

  return (
    <form action={action} className="w-full">
      {choice}
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
