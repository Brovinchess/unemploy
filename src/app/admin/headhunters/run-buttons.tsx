"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { mindHistory, refreshBalances, rerunShortSearches, type MindHistoryRow, runSearchFor, setRolesFor, shortCandidates, type RunResult } from "@/app/admin-actions";
import { RefreshCw } from "lucide-react";

// One headhunter: start a search with its own settings. The person pays from their cognition.
export function RunOne({ profileId, disabled, defaultJobs = 5 }: { profileId: string; disabled?: boolean; defaultJobs?: number }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string>();
  const [jobs, setJobs] = useState(defaultJobs);
  const router = useRouter();
  return (
    <span className="inline-flex items-center gap-2">
      <input
        type="number"
        min={1}
        max={10}
        value={jobs}
        onChange={(e) => setJobs(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
        aria-label="Jobs to ask for"
        title="How many jobs this search asks for"
        className="h-7 w-12 rounded-full bg-white/[0.06] px-2 text-center text-xs text-white/80 ring-1 ring-white/10"
      />
      <button
        type="button"
        disabled={pending || disabled}
        title="Start a search for this headhunter now, with its own settings"
        className="inline-flex h-7 items-center gap-1 rounded-full bg-white/[0.06] px-2.5 text-xs text-white/70 ring-1 ring-white/10 hover:text-white disabled:opacity-40"
        onClick={() =>
          start(async () => {
            const r = await runSearchFor(profileId, jobs);
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

// One headhunter: change the titles it looks for. Used when helping a person by hand.
export function RolesEditor({ profileId, roles }: { profileId: string; roles: string }) {
  const [value, setValue] = useState(roles);
  const [note, setNote] = useState<string>();
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await setRolesFor(profileId, value);
          setNote(r.note);
          router.refresh();
        });
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={300}
        aria-label="Titles this headhunter looks for"
        className="h-8 min-w-[18rem] flex-1 rounded-full bg-white/[0.06] px-3 text-xs text-white/80 ring-1 ring-white/10"
      />
      <button type="submit" disabled={pending || value.trim() === roles.trim()} className="btn btn-ghost btn-sm">
        {pending ? "Saving…" : "Save titles"}
      </button>
      {note && <span className="admin-text-3 text-xs">{note}</span>}
    </form>
  );
}

// Read every live headhunter's cognition from Hello Minds now.
export function RefreshBalances() {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string>();
  const router = useRouter();
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={pending}
        title="Ask Hello Minds for every live headhunter's balance now"
        onClick={() =>
          start(async () => {
            const r = await refreshBalances();
            setNote(`${r.checked} read${r.empty ? `, ${r.empty} at zero or below` : ""}${r.failed ? `, ${r.failed} could not be read` : ""}.`);
            router.refresh();
          })
        }
      >
        <RefreshCw className={`size-3.5 ${pending ? "animate-spin" : ""}`} aria-hidden /> {pending ? "Reading…" : "Refresh balances"}
      </button>
      {note && <span className="admin-text-3 text-xs">{note}</span>}
    </span>
  );
}

// Read-only: does each person own Minds made before their Career Ninja one? Shown with the balance.
export function MindHistory() {
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<MindHistoryRow[]>();
  return (
    <div className="mt-6">
      <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => setRows(await mindHistory()))}>
        {pending ? "Reading Hello Minds…" : "Check Mind history"}
      </button>
      {rows && (
        <div className="admin-table mt-3 max-h-[60vh] overflow-auto rounded-2xl border border-white/[0.06]">
          <table className="w-full text-left text-sm">
            <thead className="admin-text-2 text-[11px] uppercase tracking-wide">
              <tr>{["Person", "Joined us", "Balance", "Minds on account", "Made before ours", "Oldest Mind", "Our Mind", "Note"].map((h) => <th key={h} className="whitespace-nowrap border-b border-white/[0.06] px-3 py-2.5 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId}>
                  <td className="px-3 py-2"><a className="underline decoration-white/20" href={`/admin/users/${r.userId}`}>{r.username}</a></td>
                  <td className="px-3 py-2 tabular-nums">{r.joined}</td>
                  <td className={`px-3 py-2 tabular-nums ${r.balance != null && r.balance <= 0 ? "text-rose-300" : ""}`}>{r.balance == null ? "–" : Math.round(r.balance)}</td>
                  <td className="px-3 py-2 tabular-nums">{r.error ? "–" : r.total}</td>
                  <td className={`px-3 py-2 tabular-nums ${r.older ? "text-amber-300" : ""}`}>{r.error ? "–" : r.older}</td>
                  <td className="px-3 py-2 tabular-nums">{r.oldest ?? "–"}</td>
                  <td className="admin-text-3 px-3 py-2 text-xs">{r.ours}</td>
                  <td className="admin-text-3 px-3 py-2 text-xs">{r.error ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
