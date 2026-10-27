"use client";

import { TitleInput } from "@/components/title-input";

const MAX_ROLES_CHARS = 300; // matches preferencesSchema.targetRoles

import { useEffect, useRef, useState, useTransition } from "react";
import { Pencil, Lightbulb } from "lucide-react";
import { savePreferences } from "@/app/actions";
import { Ninja } from "@/components/brand";
import { JobsSlider } from "@/components/jobs-slider";
import { CognitionNote } from "@/components/cognition-note";
import { UsernameRow } from "@/components/username-row";
import { FormError } from "@/components/onboarding-shell";
import { checkRoles, type RoleCheck } from "@/lib/job-titles";
import { citiesOf, COUNTRY_LIST, POPULAR_COUNTRIES } from "@/lib/places";
import {
  JOB_TYPES,
  RECOMMENDED_JOBS_PER_SEARCH,
  LEVELS,
  REMOTE_SCOPES,
  summarizePreferences,
  WORK_SETTINGS,
  type Preferences, MAX_POSTING_AGE_DAYS, POSTING_AGE_OPTIONS, extraPlacesText, MAX_EXTRA_PLACES } from "@/lib/preferences";


type Draft = Partial<Preferences>;

type Question = {
  key: keyof Preferences;
  ask: (d: Draft) => string;
  skip?: (d: Draft) => boolean;
  defaulted?: boolean; // starts wide and isn't asked during setup; editable from the summary
};

const QUESTIONS: Question[] = [
  { key: "targetRoles", ask: () => "Which roles should I look for? I've guessed from your resume; change it if you want something else." },
  { key: "country", ask: () => "Where do you live? Pick your country, then your city if it's on the list." },
  { key: "city", ask: (d) => `Any particular city in ${d.country}? Leave it blank to search the whole country.`, defaulted: true },
  { key: "extraPlaces", ask: () => "Would you also work somewhere else? Add up to two places. I search where you live first, then these.", defaulted: true },
  { key: "workSettings", ask: () => "How do you want to work? All three are on, so I search near you first and then widen. Switch off any you don't want.", defaulted: true },
  {
    key: "remoteScope",
    ask: () => "For remote jobs, where can the company be based?",
    skip: (d) => !d.workSettings?.includes("remote"),
    defaulted: true,
  },
  { key: "jobTypes", ask: () => "What type of job?", defaulted: true },
  { key: "levels", ask: () => "What level are you at?", defaulted: true },
  { key: "avoidCompanies", ask: () => "Any companies I should avoid? Separate them with commas.", defaulted: true },
  { key: "needsVisa", ask: () => "Do you need visa sponsorship to work there?", defaulted: true },
  { key: "jobsPerDay", ask: () => "How many jobs should I bring you each time you ask me to search? Fewer means I can check each one more carefully, and it uses less cognition.", defaulted: true },
  { key: "maxPostingAgeDays", ask: () => "How recent should a posting be? Older ones are more often filled already, but allowing more gives me more to choose from.", defaulted: true },
];

// Setup asks two things: the roles and where you live. Everything else starts as wide as sensible, so the first search casts
// a broad net and comes back faster; each default has a pencil in the summary.
const DEFAULTS: Draft = {
  city: "",
  extraPlaces: [],
  avoidCompanies: "",
  workSettings: ["onsite", "hybrid", "remote"],
  remoteScope: "region",
  jobTypes: ["Full-time", "Contract"],
  levels: [], // match the resume
  needsVisa: false,
  jobsPerDay: RECOMMENDED_JOBS_PER_SEARCH,
  maxPostingAgeDays: 60,
};

function answerText(key: keyof Preferences, d: Draft): string {
  const v = d[key];
  switch (key) {
    case "workSettings":
      return (v as string[]).map((w) => WORK_SETTINGS.find((x) => x.value === w)?.label).join(", ");
    case "remoteScope":
      return REMOTE_SCOPES.find((r) => r.value === v)?.label ?? "";
    case "jobTypes":
      return (v as string[]).join(", ");
    case "levels":
      return (v as string[]).length ? (v as string[]).join(", ") : "Match my resume";
    case "country":
      return [d.city, d.country].filter(Boolean).join(", ");
    case "extraPlaces":
      return extraPlacesText(d as Preferences, true) || "Nowhere else";
    case "needsVisa":
      return v ? "Yes, I need sponsorship" : "No";
    case "jobsPerDay":
      return `${v} per search`;
    case "maxPostingAgeDays":
      return `Last ${v ?? MAX_POSTING_AGE_DAYS} days`;
    default:
      return (v as string) || "Skip";
  }
}

export function PreferencesChat({
  profileId,
  mode,
  initial,
  seed,
  tips = [],
  username,
}: {
  profileId: string;
  mode: "setup" | "edit";
  initial?: Preferences;
  seed?: Draft; // answers from another headhunter, pre-filled but still asked
  tips?: { target: string; text: string }[]; // coach tips, shown beside the row they're about
  username?: string; // setup only: the handle picked from the resume, editable here
}) {
  const [draft, setDraft] = useState<Draft>(initial ?? { ...DEFAULTS, ...Object.fromEntries(Object.entries(seed ?? {}).filter(([, v]) => v !== undefined && v !== "")) });
  const [step, setStep] = useState(initial ? QUESTIONS.length : 0); // QUESTIONS.length = summary
  const [editing, setEditing] = useState(false); // came from summary to fix one answer
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const bottom = useRef<HTMLDivElement>(null);

  // Arriving from a coach tip (#pref-<key>): scroll to that row and light it up.
  useEffect(() => {
    if (mode !== "edit") return;
    const key = window.location.hash.match(/^#pref-(\w+)$/)?.[1];
    if (!key || !QUESTIONS.some((q) => q.key === key)) return;
    const el = () => document.getElementById(`pref-${key}`);
    const t = setTimeout(() => {
      el()?.scrollIntoView({ behavior: "smooth", block: "center" });
      el()?.classList.add("spotlight");
    }, 80);
    const off = setTimeout(() => el()?.classList.remove("spotlight"), 4000);
    return () => {
      clearTimeout(t);
      clearTimeout(off);
    };
  }, [mode]);

  // During setup the defaulted questions stay hidden; editing from the summary shows any of them.
  const visible = QUESTIONS.filter((q) => !q.skip?.(draft) && (editing || mode === "edit" || !q.defaulted));
  const current = visible.find((q) => QUESTIONS.indexOf(q) === step);

  useEffect(() => {
    if (!editing) bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [step, editing]);

  function answer(patch: Draft) {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (editing) {
      setEditing(false);
      setStep(QUESTIONS.length);
      return;
    }
    let i = step + 1;
    while (i < QUESTIONS.length && (QUESTIONS[i].skip?.(next) || (mode === "setup" && QUESTIONS[i].defaulted))) i++;
    setStep(i);
  }

  const [saved, setSaved] = useState(false);
  function submit() {
    start(async () => {
      const r = await savePreferences(profileId, draft as Preferences);
      if (r?.error) setError(r.error);
      else if (mode === "edit") {
        setError(undefined);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  const answered = editing ? [] : visible.filter((q) => QUESTIONS.indexOf(q) < step);
  const onSummary = step >= QUESTIONS.length && !editing;

  return (
    <div className="w-full">
      {!onSummary && (
        <div className="space-y-5" aria-live="polite">
          {answered.map((q) => (
            <div key={q.key} className="space-y-2">
              <Bubble from="mind">{q.ask(draft)}</Bubble>
              <Bubble from="user">{answerText(q.key, draft)}</Bubble>
            </div>
          ))}
          {current && (
            <div className="space-y-3">
              <Bubble from="mind">{current.ask(draft)}</Bubble>
              <AnswerInput key={current.key} question={current} draft={draft} onAnswer={answer} seedRoles={seed?.targetRoles} />
            </div>
          )}
          <div ref={bottom} />
        </div>
      )}

      {onSummary && (
        <div>
          <div className="card divide-y divide-line overflow-hidden">
            {mode === "setup" && username && <UsernameRow username={username} />}
            {summarizePreferences(draft as Preferences)
              .map((row, i) => {
                const keys: (keyof Preferences)[] = [
                  "targetRoles", "country", "extraPlaces", "workSettings",
                  ...(draft.workSettings?.includes("remote") ? (["remoteScope"] as (keyof Preferences)[]) : []),
                  "jobTypes", "levels", "avoidCompanies", "needsVisa", "jobsPerDay", "maxPostingAgeDays",
                ];
                return { row, key: keys[i] };
              })
              // The number of jobs is chosen on the Find button and the Daily search panel, not here;
              // extra places are a settings-only question, so setup does not show the row.
              .filter(({ key }) => key !== "jobsPerDay" && !(mode === "setup" && key === "extraPlaces"))
              .map(({ row, key }) => {
              const tip = tips.find((t) => t.target === key);
              return (
                <div key={row.label} id={`pref-${key}`} className={`relative flex items-start justify-between gap-4 px-5 py-4 transition-shadow ${tip ? "bg-coral/[0.07]" : ""}`}>
                  <div className="min-w-0">
                    <p className="text-sm text-muted">{row.label}</p>
                    <p className="mt-0.5 font-medium text-ink">{row.value}</p>
                    {tip && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-sm text-coral">
                        <Lightbulb className="size-3.5 shrink-0" aria-hidden /> {tip.text}
                      </p>
                    )}
                  </div>
                  <button
                    className={`mt-1 ${tip ? "rounded-full bg-coral px-3 py-1.5 text-xs font-medium text-white hover:bg-rose" : "text-muted hover:text-navy"}`}
                    aria-label={`Change ${row.label.toLowerCase()}`}
                    onClick={() => {
                      setEditing(true);
                      setStep(QUESTIONS.findIndex((q) => q.key === key));
                    }}
                  >
                    {tip ? "Change" : <Pencil className="size-4" aria-hidden />}
                  </button>
                </div>
              );
            })}
          </div>
          {mode === "setup" && (
            <div className="mt-6 rounded-3xl bg-night-2 p-5">
              <CognitionNote />
            </div>
          )}
          <FormError message={error} />
          <button className="btn btn-accent mt-6 h-12 w-full" disabled={pending} onClick={submit}>
            {pending ? (mode === "setup" ? "Setting up your headhunter…" : "Saving…") : mode === "setup" ? "Start my first search" : saved ? "Saved" : "Save"}
          </button>
          {saved && <p className="mt-3 text-center text-sm text-white/55" aria-live="polite">Saved. Your next search uses these.</p>}
          {pending && mode === "setup" && (
            <p className="mt-4 text-center text-sm text-white/55" aria-live="polite">
              Picking a name, waking it up and sending it your brief. This takes a few seconds.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Bubble({ from, children }: { from: "mind" | "user"; children: React.ReactNode }) {
  return from === "mind" ? (
    <div className="flex items-end gap-2.5">
      <Ninja className="size-9 shrink-0" />
      <p className="w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-white/[0.07] px-4 py-3 leading-relaxed text-ink">{children}</p>
    </div>
  ) : (
    <p className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-coral px-4 py-3 text-white">{children}</p>
  );
}

function AnswerInput({
  question,
  draft,
  onAnswer,
  seedRoles,
}: {
  question: Question;
  draft: Draft;
  onAnswer: (p: Draft) => void;
  seedRoles?: string | null; // the resume's own guess at the title, offered first in the nudge
}) {
  const key = question.key;


  if (key === "country" || key === "city") {
    return <PlaceAnswer country={draft.country ?? ""} city={draft.city ?? ""} cityOnly={key === "city"} onSubmit={(country, city) => onAnswer({ country, city })} />;
  }
  if (key === "extraPlaces") {
    return <ExtraPlacesAnswer home={draft.country ?? ""} initial={draft.extraPlaces ?? []} onSubmit={(extraPlaces) => onAnswer({ extraPlaces })} />;
  }

  if (key === "targetRoles" || key === "avoidCompanies") {
    const required = key === "targetRoles";
    return (
      <TextAnswer
        initial={(draft[key] as string) ?? ""}
        required={required}
        check={key === "targetRoles" ? (v) => checkRoles(v, seedRoles) : undefined}
        placeholder={
          {
            targetRoles: "e.g. Product manager, Product owner",
            country: "e.g. New York, United States",
            city: "e.g. New York",
            avoidCompanies: "e.g. Acme, Globex",
          }[key]
        }
        onSubmit={(v) => onAnswer({ [key]: v })}
      />
    );
  }

  if (key === "workSettings") {
    return <MultiChoice options={WORK_SETTINGS.map((w) => ({ value: w.value, label: w.label }))} initial={draft.workSettings} onSubmit={(v) => onAnswer({ workSettings: v as Preferences["workSettings"] })} />;
  }
  if (key === "jobTypes") {
    return <MultiChoice options={JOB_TYPES.map((v) => ({ value: v, label: v }))} initial={draft.jobTypes ?? ["Full-time"]} onSubmit={(v) => onAnswer({ jobTypes: v as Preferences["jobTypes"] })} />;
  }
  if (key === "levels") {
    return (
      <div>
        <MultiChoice options={LEVELS.map((v) => ({ value: v, label: v }))} initial={draft.levels} onSubmit={(v) => onAnswer({ levels: v as Preferences["levels"] })} />
        <button type="button" className="mt-3 text-sm text-white/55 underline decoration-white/30 underline-offset-4 hover:text-white" onClick={() => onAnswer({ levels: [] })}>
          Or let it match my resume
        </button>
      </div>
    );
  }
  if (key === "remoteScope") {
    return (
      <div className="flex flex-wrap gap-2">
        {REMOTE_SCOPES.map((r) => (
          <button key={r.value} className="chip" aria-pressed={draft.remoteScope === r.value} onClick={() => onAnswer({ remoteScope: r.value })}>
            {r.label}
          </button>
        ))}
      </div>
    );
  }
  if (key === "needsVisa") {
    return (
      <div className="flex flex-wrap gap-2">
        <button className="chip" onClick={() => onAnswer({ needsVisa: false })}>No</button>
        <button className="chip" onClick={() => onAnswer({ needsVisa: true })}>Yes, I need sponsorship</button>
      </div>
    );
  }
  if (key === "maxPostingAgeDays") {
    const current = draft.maxPostingAgeDays ?? MAX_POSTING_AGE_DAYS;
    return (
      <div className="flex flex-wrap gap-2">
        {POSTING_AGE_OPTIONS.map((d) => (
          <button key={d} className="chip" aria-pressed={current === d} onClick={() => onAnswer({ maxPostingAgeDays: d })}>
            Last {d} days
          </button>
        ))}
      </div>
    );
  }
  // jobsPerDay
  return <SliderAnswer initial={draft.jobsPerDay ?? RECOMMENDED_JOBS_PER_SEARCH} onSubmit={(n) => onAnswer({ jobsPerDay: n })} />;
}



function SliderAnswer({ initial, onSubmit }: { initial: number; onSubmit: (n: number) => void }) {
  const [n, setN] = useState(initial);
  return (
    <div className="rounded-2xl bg-white/[0.04] p-5">
      <JobsSlider value={n} onChange={setN} />
      <button className="btn btn-primary mt-5" onClick={() => onSubmit(n)}>
        Next
      </button>
    </div>
  );
}

// Where you live: a country from the full list (popular ones first), then a city from that
// country's list or typed. Nothing to spell, so the place is always one the app recognises.
function PlaceAnswer({ country, city, cityOnly, onSubmit, submitLabel }: { country: string; city: string; cityOnly: boolean; onSubmit: (country: string, city: string) => void; submitLabel?: string }) {
  const [c, setC] = useState(country);
  const [t, setT] = useState(city);
  const cities = citiesOf(c);
  const rest = COUNTRY_LIST.filter((x) => !POPULAR_COUNTRIES.includes(x));
  return (
    <form
      className="w-full"
      onSubmit={(e) => {
        e.preventDefault();
        if (c) onSubmit(c, t.trim());
      }}
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        {!cityOnly && (
          <select className="field" value={c} onChange={(e) => (setC(e.target.value), setT(""))} aria-label="Country" autoFocus>
            <option value="">Country</option>
            <optgroup label="Most people here">
              {POPULAR_COUNTRIES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </optgroup>
            <optgroup label="All countries">
              {rest.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </optgroup>
          </select>
        )}
        <input
          className="field"
          list="unemploy-cities"
          value={t}
          onChange={(e) => setT(e.target.value)}
          placeholder={c ? (cities.length ? `City in ${c}, or leave blank` : `City in ${c}, optional`) : "City, after the country"}
          disabled={!c}
          aria-label="City"
          autoFocus={cityOnly}
        />
        <datalist id="unemploy-cities">
          {cities.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
        <button className="btn btn-primary shrink-0" disabled={!c}>
          {submitLabel ?? (cityOnly && !t.trim() ? "Whole country" : "Next")}
        </button>
      </div>
      {cities.length > 0 && !t && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {cities.slice(0, 8).map((x) => (
            <button key={x} type="button" className="chip min-h-8 px-3 text-xs" onClick={() => setT(x)}>
              {x}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}

function TextAnswer({
  initial,
  required,
  placeholder,
  list,
  check,
  onSubmit,
}: {
  initial: string;
  required: boolean;
  placeholder?: string;
  list?: string[];
  check?: (v: string) => RoleCheck; // a nudge when the answer isn't something employers post
  onSubmit: (v: string) => void;
}) {
  const [value, setValue] = useState(initial);
  // Job titles have a length limit; past it the last step would fail, so stop here and say why.
  const tooLong = !!check && value.trim().length > MAX_ROLES_CHARS;
  const ok = (!required || value.trim().length >= 2) && !tooLong;
  const nudge = check && value.trim().length >= 3 ? check(value) : undefined;
  // A tapped suggestion replaces the vague part, keeping any real titles typed beside it.
  const take = (title: string) => {
    if (!nudge) return setValue(title);
    const keep = value.split(/,|\/| or /i).map((s) => s.trim()).filter((p) => p && !nudge.vague.includes(p));
    setValue([...keep, title].join(", "));
  };
  return (
    <form
      className="w-full"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onSubmit(value.trim());
      }}
    >
      <div className="flex gap-2">
        {check ? (
          <TitleInput value={value} onChange={setValue} multi placeholder={placeholder} autoFocus ariaLabel="Your answer" />
        ) : (
          <input
            className="field"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            list={list ? "unemploy-countries" : undefined}
            autoFocus
            aria-label="Your answer"
          />
        )}
        {list && (
          <datalist id="unemploy-countries">
            {list.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        )}
        <button className="btn btn-primary shrink-0" disabled={!ok}>
          {!required && !value.trim() ? "Skip" : "Next"}
        </button>
      </div>
      {tooLong && (
        <p className="mt-3 rounded-2xl bg-coral/10 px-4 py-3 text-sm text-white/80" role="status">
          That&rsquo;s a lot of titles. Keep it to about 6 of the closest ones, so your headhunter can search each of them well.
        </p>
      )}
      {nudge && !nudge.ok && (
        <div className="mt-3 rounded-2xl bg-coral/10 px-4 py-3 text-sm" role="status">
          <p className="text-white/80">
            &ldquo;{nudge.vague[0]}&rdquo; isn&rsquo;t a title employers post, so the search would come back empty. Did you mean one of these?
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {nudge.suggestions.map((s) => (
              <button key={s} type="button" className="chip min-h-9 px-3.5 text-sm" onClick={() => take(s)}>
                {s}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-white/45">Or keep your own words and press Next.</p>
        </div>
      )}
    </form>
  );
}

function MultiChoice({
  options,
  initial,
  onSubmit,
}: {
  options: { value: string; label: string }[];
  initial?: string[];
  onSubmit: (v: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>(initial ?? []);
  const toggle = (v: string) => setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.value} className="chip" aria-pressed={picked.includes(o.value)} onClick={() => toggle(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      <button className="btn btn-primary mt-4" disabled={!picked.length} onClick={() => onSubmit(picked)}>
        Next
      </button>
    </div>
  );
}


// Places the person would also work in, besides home: up to two, each picked the same way as
// home. A place in another country asks about visa sponsorship there. Never part of setup.
type ExtraPlace = NonNullable<Preferences["extraPlaces"]>[number];
function ExtraPlacesAnswer({ home, initial, onSubmit }: { home: string; initial: ExtraPlace[]; onSubmit: (places: ExtraPlace[]) => void }) {
  const [places, setPlaces] = useState<ExtraPlace[]>(initial);
  const name = (x: ExtraPlace) => [x.city, x.country].filter(Boolean).join(", ");
  return (
    <div className="w-full space-y-3">
      {places.length > 0 && (
        <ul className="space-y-2">
          {places.map((x, i) => (
            <li key={`${x.country}-${x.city}`} className="rounded-2xl bg-surface-2 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-ink">{name(x)}</span>
                <button type="button" className="text-sm text-muted hover:text-navy" onClick={() => setPlaces(places.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
              {x.country !== home && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted">Need visa sponsorship there?</span>
                  <button type="button" className={`chip min-h-8 px-3 text-xs ${!x.needsVisa ? "chip-on" : ""}`} aria-pressed={!x.needsVisa} onClick={() => setPlaces(places.map((y, j) => (j === i ? { ...y, needsVisa: false } : y)))}>
                    No
                  </button>
                  <button type="button" className={`chip min-h-8 px-3 text-xs ${x.needsVisa ? "chip-on" : ""}`} aria-pressed={!!x.needsVisa} onClick={() => setPlaces(places.map((y, j) => (j === i ? { ...y, needsVisa: true } : y)))}>
                    Yes
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {places.length < MAX_EXTRA_PLACES && (
        <PlaceAnswer key={places.length} country="" city="" cityOnly={false} submitLabel="Add place" onSubmit={(country, city) => setPlaces([...places, { country, city, needsVisa: false }])} />
      )}
      <p className="text-xs text-muted">Each extra place adds a little to each search.</p>
      <button type="button" className="btn btn-primary" onClick={() => onSubmit(places)}>
        {places.length ? "Done" : "Nowhere else"}
      </button>
    </div>
  );
}
