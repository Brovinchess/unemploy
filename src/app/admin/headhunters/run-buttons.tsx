"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { rerunShortSearches, runSearchFor, shortCandidates, type RunResult } from "@/app/admin-actions";

// One headhunter: start a search with its own settings. The person pays from their cognition.
export function RunOne({ profileId, disabled }: { profileId: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string>();
  const router = useRouter();
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending || disabled}
        title="Start a search for this headhunter now, with its own settings"
        className="inline-flex h-7 items-center gap-1 rounded-full bg-white/[0.06] px-2.5 text-xs text-white/70 ring-1 ring-white/10 hover:text-white disabled:opacity-40"
        onClick={() =>
          start(async () => {
            const r = await runSearchFor(profileId);
            setNote(r.note);
            router.refresh();
          })
        }
      >
        <Play className="size-3" aria-hidden /> {pending ? "Starting…" : "Run"}
      </button>
      {note && <span className="admin-text-3 text-xs">{note}</span>}
    </span>
  );
}

// Everyone whose last search came back short and who still has cognition: show who, confirm, run.
export function RerunShort() {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Awaited<ReturnType<typeof shortCandidates>>>();
  const [results, setResults] = useState<RunResult[]>();
  const [zeroOnly, setZeroOnly] = useState(true);
  const [pending, start] = useTransition();
  const router = useRouter();
  const load = (z = zeroOnly) =>
    start(async () => {
      setList(await shortCandidates(z));
      setOpen(true);
    });
  const run = () =>
    start(async () => {
      setResults(await rerunShortSearches(zeroOnly));
      router.refresh();
    });
  return (
    <div className="relative">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => load()} disabled={pending}>
        <Play className="size-3.5" aria-hidden /> Re-run short searches
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-[26rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-[#141b22] p-4 text-sm shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
          {results ? (
            <>
              <p className="font-medium text-white">Done. {results.filter((r) => r.ok).length} of {results.length} started.</p>
              <ul className="mt-2 max-h-64 space-y-1 overflow-auto">
                {results.map((r) => (
                  <li key={r.username + r.label} className={r.ok ? "text-white/70" : "text-rose-300"}>
                    {r.username} · {r.label}: {r.note}
                  </li>
                ))}
              </ul>
              <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={() => (setOpen(false), setResults(undefined))}>
                Close
              </button>
            </>
          ) : (
            <>
              <p className="font-medium text-white">{list?.length ?? 0} headhunters {zeroOnly ? "found nothing last time" : "came back short"} and have cognition left.</p>
              <label className="mt-2 flex items-center gap-2 text-xs text-white/70">
                <input type="checkbox" checked={zeroOnly} onChange={(e) => (setZeroOnly(e.target.checked), load(e.target.checked))} /> Only the ones that found nothing
              </label>
              <p className="admin-text-3 mt-1 text-xs">Each gets a fresh search with its own settings and the current brief. The person pays from their Mind. Only people with a verified email and updates on get an email at the end; the rest see the jobs on their next visit.</p>
              <ul className="mt-2 max-h-48 space-y-0.5 overflow-auto text-white/70">
                {list?.map((c) => (
                  <li key={c.id}>
                    {c.username} · {c.label} · {c.balance} cognition
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <button type="button" className="btn btn-accent btn-sm" onClick={run} disabled={pending || !list?.length}>
                  {pending ? "Starting…" : `Start ${list?.length ?? 0} searches`}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} disabled={pending}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
