"use client";

import { useState, useTransition } from "react";
import { Sunrise } from "lucide-react";
import { setMorningSearch } from "@/app/actions";
import { AUTO_SEARCH_DAYS, estimateSearchCost, MAX_JOBS_PER_SEARCH, MIN_JOBS_PER_SEARCH, type AutoSearchDaysValue } from "@/lib/preferences";

// Morning searches, in three states. Off: one sentence and an Enable button. Setting up: the
// slider and the days, nothing saved until "Start morning searches" is pressed. On: the saved
// settings, editable, with "Save changes" once something differs and "Turn off" beside it.
// The saved values live on the headhunter's row in the database; the hourly cron reads them.
export function MorningSearch({
  profileId,
  jobs: savedJobs,
  days: savedDays,
  defaultJobs,
  perJob,
  extraPlaces = 0,
  balance,
  email,
  disabled,
  compact = false,
}: {
  profileId: string;
  jobs: number | null; // null when off
  days: AutoSearchDaysValue;
  defaultJobs: number;
  perJob?: number;
  extraPlaces?: number;
  balance?: number | null;
  email: string | null; // where the day's emails go, if any
  disabled?: string; // why it can't be turned on
  compact?: boolean; // in Settings: no card chrome of its own
}) {
  const on = savedJobs != null;
  const [editing, setEditing] = useState(false);
  const [jobs, setJobs] = useState(savedJobs ?? Math.min(defaultJobs, 3));
  const [days, setDays] = useState<AutoSearchDaysValue>(savedDays);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  // The page re-renders with the saved values after each save; the draft follows them.
  const [seen, setSeen] = useState({ savedJobs, savedDays });
  if (seen.savedJobs !== savedJobs || seen.savedDays !== savedDays) {
    setSeen({ savedJobs, savedDays });
    if (savedJobs != null) {
      setJobs(savedJobs);
      setDays(savedDays);
    }
  }
  const dirty = !on || jobs !== savedJobs || days !== savedDays;
  const save = (next: { jobs: number; days: AutoSearchDaysValue } | null) =>
    start(async () => {
      const r = await setMorningSearch(profileId, next);
      setError(r?.error);
      if (!r?.error) {
        setEditing(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  const perDay = estimateSearchCost(jobs, perJob, extraPlaces).cognition;
  const pct = ((jobs - MIN_JOBS_PER_SEARCH) / (MAX_JOBS_PER_SEARCH - MIN_JOBS_PER_SEARCH)) * 100;
  const when = (d: AutoSearchDaysValue) => AUTO_SEARCH_DAYS.find((x) => x.value === d)?.short ?? "every day";
  const perWeek = days === "daily" ? 7 : days === "weekdays" ? 5 : days === "alternate" ? 3.5 : 1;
  const weekCost = Math.round(perDay * perWeek);
  const tooDear = balance != null && perDay > balance;
  const showControls = on || editing;

  return (
    <section id="morning" className={compact ? "" : "rise rise-2 mt-6 scroll-mt-8 rounded-3xl bg-surface p-6"}>
      <div className="flex items-start gap-4">
        {!compact && (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] text-white/60">
            <Sunrise className="size-4" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-medium text-white">Morning searches</h2>
              <p className="mt-0.5 text-sm text-white/50">
                {on
                  ? `On. ${savedJobs} ${savedJobs === 1 ? "job" : "jobs"} ${when(savedDays)}, at 9am your time.`
                  : disabled ?? "Your headhunter searches on its own at 9am your time, as often as you like."}
              </p>
            </div>
            {!showControls && (
              <button type="button" className="btn btn-primary h-10 shrink-0" disabled={!!disabled || pending} onClick={() => setEditing(true)}>
                Enable
              </button>
            )}
            {on && !compact && saved && <span className="text-xs text-white/40">Saved</span>}
          </div>

          {showControls && (
            <div className="mt-5 space-y-5">
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-sm text-white/60">Jobs each morning</p>
                  <p className="font-display text-3xl font-medium text-white">{jobs}</p>
                </div>
                <input
                  type="range"
                  min={MIN_JOBS_PER_SEARCH}
                  max={MAX_JOBS_PER_SEARCH}
                  step={1}
                  value={jobs}
                  disabled={pending}
                  onChange={(e) => setJobs(Number(e.target.value))}
                  aria-label="Jobs each morning"
                  className="slider mt-3 w-full"
                  style={{ ["--fill" as string]: `${pct}%` }}
                />
                <div className="mt-1 flex justify-between text-xs text-white/35">
                  <span>{MIN_JOBS_PER_SEARCH}</span>
                  <span>{MAX_JOBS_PER_SEARCH}</span>
                </div>
                <p className="mt-2 text-xs text-white/40">If the morning falls short, it searches once more three hours later, wider, for the rest.</p>
              </div>

              <div>
                <p className="text-sm text-white/60">How often</p>
                <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="How often">
                  {AUTO_SEARCH_DAYS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      role="radio"
                      aria-checked={days === d.value}
                      disabled={pending}
                      onClick={() => setDays(d.value)}
                      className={`rounded-full px-3.5 py-1.5 text-sm transition ${days === d.value ? "bg-coral text-white" : "bg-white/[0.06] text-white/70 hover:bg-white/[0.1] hover:text-white"}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-sm text-white/55">
                About <span className="text-white">{perDay} cognition</span> a morning, around {weekCost} a week
                {balance != null && !tooDear ? <span className="text-white/40"> · {Math.round(balance)} available</span> : null}. More on a day with a second search. Stops by itself when the balance runs out.
                {email ? ` Results go to ${email}.` : " Add an email in Settings and the results reach you each morning."}
              </p>
              {tooDear && <p className="text-sm text-rose">Not enough cognition for a morning like this. You have {Math.round(balance ?? 0)}. Pick fewer jobs or top up.</p>}

              <div className="flex flex-wrap items-center gap-4">
                {dirty && (
                  <button type="button" className="btn btn-primary h-10" disabled={pending} onClick={() => save({ jobs, days })}>
                    {pending ? "Saving…" : on ? "Save changes" : "Start morning searches"}
                  </button>
                )}
                {!dirty && saved && <span className="text-sm text-white/45">Saved. Next run at 9am.</span>}
                {on ? (
                  <button type="button" className="text-sm text-white/55 hover:text-rose" disabled={pending} onClick={() => save(null)}>
                    Turn off
                  </button>
                ) : (
                  <button type="button" className="text-sm text-white/55 hover:text-white" disabled={pending} onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
          {error && <p className="mt-3 text-sm text-rose">{error}</p>}
        </div>
      </div>
    </section>
  );
}
