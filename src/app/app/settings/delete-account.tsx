"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { deleteAccount, noteKept, setPaused } from "@/app/actions";
import { Ninja } from "@/components/brand";
import type { LeaveReason } from "@/db/schema";

export type AccountFacts = {
  jobs: number;
  kept: number;
  applied: number;
  answers: number;
  headhunters: { id: string; label: string; paused: boolean }[];
  dailyOn: boolean;
};

// Each reason, with the one thing that might help instead. Shown only once someone picks it.
const REASONS: { key: LeaveReason; label: string; help?: string; action?: "pause" | "headhunter" | "resume" }[] = [
  { key: "found_job", label: "I found a job", help: "Congratulations. You can pause your headhunter instead. It keeps everything and spends nothing until you need it again.", action: "pause" },
  { key: "not_looking", label: "I'm not looking right now", help: "You can pause your headhunter instead. It keeps your resume and jobs, and spends nothing until you turn it back on.", action: "pause" },
  { key: "poor_fit", label: "The jobs didn't fit me", help: "Your headhunter checks each job against your resume. Adding more of your experience often changes which jobs come through.", action: "resume" },
  { key: "few_jobs", label: "It found too few jobs where I live", help: "Adding a second city or a related job title usually brings in more. You can change both on your headhunter's page.", action: "headhunter" },
  { key: "slow", label: "Searches take too long", help: "Each job is checked to be open and a good fit before it reaches you, which takes 20 to 60 minutes. Daily search runs on its own, so you don't have to wait." },
  { key: "cost", label: "It costs too much cognition", help: "Cognition is only used while a search runs. You can turn off daily search on your headhunter's page and search only when you choose.", action: "headhunter" },
  { key: "broken", label: "Something didn't work", help: "We're sorry about that. Tell us what happened below and we'll look into it." },
  { key: "privacy", label: "I'm worried about my data", help: "Your resume is only used to check jobs and write your applications. Deleting your account removes it from Career Ninja." },
  { key: "other", label: "Something else" },
];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Delete in three short steps: what you'd lose (with a gentler option), why you're leaving,
// then one final confirmation. Each step can be left with "Keep my account".
export function DeleteAccount({ facts }: { facts: AccountFacts }) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [reason, setReason] = useState<LeaveReason>();
  const [details, setDetails] = useState("");
  const [sure, setSure] = useState(false);
  const [paused, setPausedNote] = useState(false);
  const [pending, start] = useTransition();
  const chosen = REASONS.find((r) => r.key === reason);
  const main = facts.headhunters[0];
  const canPause = facts.headhunters.some((h) => !h.paused);

  const close = (kept = true) => {
    if (kept && step > 0) noteKept("delete").catch(() => {});
    setStep(0);
    setReason(undefined);
    setDetails("");
    setSure(false);
  };

  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const pauseAll = () =>
    start(async () => {
      for (const h of facts.headhunters) if (!h.paused) await setPaused(h.id, true);
      noteKept("delete").catch(() => {});
      setPausedNote(true);
      setStep(0);
    });

  const losses = [
    facts.jobs > 0 && `${plural(facts.jobs, "job")} your headhunter found${facts.kept ? `, and the ${facts.kept} you kept` : ""}`,
    facts.applied > 0 && `The progress on ${plural(facts.applied, "application")}`,
    "Your resume and the applications written from it",
    facts.answers > 0 && `${plural(facts.answers, "saved answer")} the extension fills in for you`,
    facts.dailyOn && "Your daily search, which looks for new jobs on its own",
  ].filter(Boolean) as string[];

  const dialog =
    step > 0 &&
    createPortal(
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-night/80 p-4 backdrop-blur-sm sm:items-center" onClick={() => close()}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/[0.08] bg-night-2 p-6 text-left shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] sm:p-7"
          onClick={(e) => e.stopPropagation()}
        >
          <button className="absolute right-5 top-5 text-white/40 hover:text-white" onClick={() => close()} aria-label="Close">
            <X className="size-4" />
          </button>
          <p className="text-xs font-medium uppercase tracking-wide text-white/40">Step {step} of 3</p>

          {step === 1 && (
            <>
              <Ninja mood="sad" className="mx-auto mt-2 size-20" />
              <h2 id="delete-title" className="font-display mt-3 text-center text-xl font-medium text-white">
                We&rsquo;re sorry to see you go
              </h2>
              <p className="mt-2 text-center text-sm text-white/60">Before you decide, here&rsquo;s what deleting your account removes for good.</p>
              <ul className="mt-5 space-y-2 rounded-2xl bg-white/[0.04] px-5 py-4 text-sm text-white/80">
                {losses.map((l) => (
                  <li key={l} className="flex gap-2">
                    <span className="text-rose" aria-hidden>
                      ×
                    </span>
                    {l}
                  </li>
                ))}
              </ul>
              {canPause && (
                <div className="mt-4 rounded-2xl border border-white/[0.08] px-5 py-4 text-sm">
                  <p className="text-white">Just need a break?</p>
                  <p className="mt-1 text-white/60">Pause your headhunter instead. Everything stays, and it uses no cognition until you turn it back on.</p>
                  <button className="btn btn-ghost btn-sm mt-3" disabled={pending} onClick={pauseAll}>
                    {pending ? "Pausing…" : "Pause my headhunter"}
                  </button>
                </div>
              )}
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <button className="btn btn-ghost text-rose" onClick={() => setStep(2)}>
                  Continue to delete
                </button>
                <button className="btn btn-accent" onClick={() => close()}>
                  Keep my account
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 id="delete-title" className="font-display mt-2 text-xl font-medium text-white">
                What&rsquo;s the main reason you&rsquo;re leaving?
              </h2>
              <p className="mt-1 text-sm text-white/60">Your answer helps us make Career Ninja better for everyone.</p>
              <fieldset className="mt-4 space-y-1.5">
                <legend className="sr-only">Main reason</legend>
                {REASONS.map((r) => (
                  <label
                    key={r.key}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors ${reason === r.key ? "bg-white/[0.08] text-white" : "text-white/75 hover:bg-white/[0.04]"}`}
                  >
                    <input type="radio" name="reason" value={r.key} checked={reason === r.key} onChange={() => setReason(r.key)} className="accent-[var(--color-coral,#c96567)]" />
                    {r.label}
                  </label>
                ))}
              </fieldset>
              {chosen?.help && (
                <div className="mt-3 rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-white/70">
                  <p>{chosen.help}</p>
                  {chosen.action === "pause" && canPause && (
                    <button className="btn btn-ghost btn-sm mt-2" disabled={pending} onClick={pauseAll}>
                      {pending ? "Pausing…" : "Pause my headhunter instead"}
                    </button>
                  )}
                  {chosen.action === "headhunter" && main && (
                    <Link href={`/app/headhunters/${main.id}#looks-for`} className="btn btn-ghost btn-sm mt-2 inline-flex" onClick={() => close()}>
                      Open my headhunter
                    </Link>
                  )}
                  {chosen.action === "resume" && main && (
                    <Link href={`/app/headhunters/${main.id}#resume`} className="btn btn-ghost btn-sm mt-2 inline-flex" onClick={() => close()}>
                      Review my resume
                    </Link>
                  )}
                </div>
              )}
              <label className="mt-4 block text-sm text-white/70">
                Anything we could have done better? <span className="text-white/40">(optional)</span>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
                  rows={3}
                  className="mt-2 w-full resize-none rounded-xl bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
                  placeholder="Tell us in a sentence or two"
                />
              </label>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <button className="btn btn-ghost" onClick={() => close()}>
                  Keep my account
                </button>
                <button className="btn btn-ghost text-rose disabled:opacity-40" disabled={!reason} onClick={() => setStep(3)}>
                  Continue
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 id="delete-title" className="font-display mt-2 text-xl font-medium text-white">
                Delete your account?
              </h2>
              <div className="mt-4 rounded-2xl border border-rose/40 bg-rose/10 px-5 py-4 text-sm text-white/85">
                <p className="font-medium text-rose">This can&rsquo;t be undone.</p>
                <p className="mt-1.5">
                  Your resume, {plural(facts.jobs, "job")} and all your applications will be deleted, and your headhunter will be turned off. Your Hello Minds account and its cognition stay as they are.
                </p>
              </div>
              <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-white/80">
                <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="mt-0.5" />I understand that my account and everything in it will be permanently deleted.
              </label>
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <button className="btn btn-ghost" onClick={() => close()}>
                  Keep my account
                </button>
                <button
                  className="btn bg-rose text-white hover:bg-rose/90 disabled:opacity-40"
                  disabled={!sure || !reason || pending}
                  onClick={() => start(() => deleteAccount(reason!, details))}
                >
                  {pending ? "Deleting…" : "Delete my account"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>,
      document.body,
    );

  return (
    <>
      <button className="btn btn-ghost text-rose" onClick={() => (setPausedNote(false), setStep(1))}>
        Delete my account
      </button>
      {paused && <p className="w-full text-sm text-white/60">Your headhunter is paused. Everything is kept, and you can turn it back on from its page whenever you like.</p>}
      {dialog}
    </>
  );
}
