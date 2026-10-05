"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { savePreferences } from "@/app/actions";
import { Ninja } from "@/components/brand";
import { JobsSlider } from "@/components/jobs-slider";
import { FormError } from "@/components/onboarding-shell";
import {
  currencyFor,
  estimateSearchCost,
  formatAmount,
  SALARY_CURRENCIES,
  salaryLabel,
  salarySteps,
  type SalaryPeriod,
  JOB_TYPES,
  RECOMMENDED_JOBS_PER_SEARCH,
  LEVELS,
  REMOTE_SCOPES,
  summarizePreferences,
  WORK_SETTINGS,
  type Preferences,
} from "@/lib/preferences";

const COUNTRIES = [
  "Malaysia", "Singapore", "Indonesia", "Thailand", "Philippines", "Vietnam", "Hong Kong", "Taiwan", "Japan",
  "South Korea", "China", "India", "Pakistan", "Bangladesh", "Australia", "New Zealand", "United Arab Emirates",
  "Saudi Arabia", "Qatar", "Bahrain", "United Kingdom", "Ireland", "Germany", "France", "Netherlands", "Spain",
  "Italy", "Portugal", "Sweden", "Denmark", "Norway", "Finland", "Poland", "Switzerland", "United States",
  "Canada", "Mexico", "Brazil", "Argentina", "Chile", "Colombia", "South Africa", "Nigeria", "Kenya", "Egypt",
];

type Draft = Partial<Preferences>;

type Question = {
  key: keyof Preferences;
  ask: (d: Draft) => string;
  skip?: (d: Draft) => boolean;
};

const QUESTIONS: Question[] = [
  { key: "targetRoles", ask: () => "Which roles should I look for?" },
  { key: "country", ask: () => "Which country do you want to work in?" },
  { key: "city", ask: (d) => `Any particular city in ${d.country}? Leave it blank to search the whole country.` },
  { key: "workSettings", ask: () => "How do you want to work? Pick all that suit you." },
  {
    key: "remoteScope",
    ask: () => "For remote jobs, where can the company be based?",
    skip: (d) => !d.workSettings?.includes("remote"),
  },
  { key: "jobTypes", ask: () => "What type of job?" },
  { key: "levels", ask: () => "What level are you at?" },
  { key: "minSalary", ask: () => "What's the least you'd want to earn? Pick a range; I'll bring jobs that pay at least that, and ones that don't show pay." },
  { key: "avoidCompanies", ask: () => "Any companies I should avoid? Separate them with commas." },
  { key: "needsVisa", ask: () => "Do you need visa sponsorship to work there?" },
  { key: "jobsPerDay", ask: () => "How many jobs should I bring you each time you ask me to search? Fewer means I can check each one more carefully, and it uses less cognition." },
];

const DEFAULTS: Draft = { city: "", minSalary: "", avoidCompanies: "", remoteScope: "country" };

function answerText(key: keyof Preferences, d: Draft): string {
  const v = d[key];
  switch (key) {
    case "workSettings":
      return (v as string[]).map((w) => WORK_SETTINGS.find((x) => x.value === w)?.label).join(", ");
    case "remoteScope":
      return REMOTE_SCOPES.find((r) => r.value === v)?.label ?? "";
    case "jobTypes":
    case "levels":
      return (v as string[]).join(", ");
    case "needsVisa":
      return v ? "Yes, I need sponsorship" : "No";
    case "minSalary":
      return (v as string) || "Any pay";
    case "jobsPerDay":
      return `${v} per search`;
    default:
      return (v as string) || "Skip";
  }
}

export function PreferencesChat({
  profileId,
  mode,
  initial,
  seed,
}: {
  profileId: string;
  mode: "setup" | "edit";
  initial?: Preferences;
  seed?: Draft; // answers from another headhunter, pre-filled but still asked
}) {
  const [draft, setDraft] = useState<Draft>(initial ?? { ...DEFAULTS, ...seed });
  const [step, setStep] = useState(initial ? QUESTIONS.length : 0); // QUESTIONS.length = summary
  const [editing, setEditing] = useState(false); // came from summary to fix one answer
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const bottom = useRef<HTMLDivElement>(null);

  const visible = QUESTIONS.filter((q) => !q.skip?.(draft));
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
    while (i < QUESTIONS.length && QUESTIONS[i].skip?.(next)) i++;
    setStep(i);
  }

  function submit() {
    start(async () => {
      const r = await savePreferences(profileId, draft as Preferences);
      if (r?.error) setError(r.error);
      else if (mode === "edit") setError(undefined);
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
              <AnswerInput key={current.key} question={current} draft={draft} onAnswer={answer} />
            </div>
          )}
          <div ref={bottom} />
        </div>
      )}

      {onSummary && (
        <div>
          <div className="card divide-y divide-line overflow-hidden">
            {summarizePreferences(draft as Preferences).map((row, i) => {
              const keys: (keyof Preferences)[] = [
                "targetRoles", "country", "workSettings", "jobTypes", "levels", "minSalary", "avoidCompanies", "needsVisa", "jobsPerDay",
              ];
              const key = keys[i];
              return (
                <div key={row.label} className="flex items-start justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="text-sm text-muted">{row.label}</p>
                    <p className="mt-0.5 font-medium text-ink">{row.value}</p>
                  </div>
                  <button
                    className="mt-1 text-muted hover:text-navy"
                    aria-label={`Change ${row.label.toLowerCase()}`}
                    onClick={() => {
                      setEditing(true);
                      setStep(QUESTIONS.findIndex((q) => q.key === key));
                    }}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-sm text-muted">
            Estimated cost: about {estimateSearchCost(draft.jobsPerDay ?? 5).cognition} cognition per search (~$
            {estimateSearchCost(draft.jobsPerDay ?? 5).usd.toFixed(2)}).
          </p>
          <FormError message={error} />
          <button className="btn btn-accent mt-8 h-12 w-full" disabled={pending} onClick={submit}>
            {pending ? "Saving…" : mode === "setup" ? "Looks good, continue" : "Save and brief my headhunter"}
          </button>
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
}: {
  question: Question;
  draft: Draft;
  onAnswer: (p: Draft) => void;
}) {
  const key = question.key;

  if (key === "minSalary") return <SalaryAnswer draft={draft} onAnswer={onAnswer} />;

  if (key === "targetRoles" || key === "country" || key === "city" || key === "avoidCompanies") {
    const required = key === "targetRoles" || key === "country";
    return (
      <TextAnswer
        initial={(draft[key] as string) ?? ""}
        required={required}
        list={key === "country" ? COUNTRIES : undefined}
        placeholder={
          {
            targetRoles: "e.g. Product designer, UX designer",
            country: "e.g. Malaysia",
            city: "e.g. Kuala Lumpur",
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
    return <MultiChoice options={LEVELS.map((v) => ({ value: v, label: v }))} initial={draft.levels} onSubmit={(v) => onAnswer({ levels: v as Preferences["levels"] })} />;
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
  // jobsPerDay
  return <SliderAnswer initial={draft.jobsPerDay ?? RECOMMENDED_JOBS_PER_SEARCH} onSubmit={(n) => onAnswer({ jobsPerDay: n })} />;
}

// Pay as a floor: tap a range ("5,000+"), switch month/year, or type another amount.
function SalaryAnswer({ draft, onAnswer }: { draft: Draft; onAnswer: (p: Draft) => void }) {
  const [currency, setCurrency] = useState(draft.salary?.currency ?? currencyFor(draft.country));
  const [period, setPeriod] = useState<SalaryPeriod>(draft.salary?.period ?? "month");
  const [other, setOther] = useState("");
  const pick = (min: number) => {
    const salary = { currency, min, period };
    onAnswer({ salary, minSalary: salaryLabel(salary) });
  };
  const typed = Number(other.replace(/[^\d.]/g, "")) * (/k\s*$/i.test(other) ? 1000 : 1);
  return (
    <div className="rounded-2xl bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-center gap-2">
        <select className="field h-9 w-auto py-0 text-sm" value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Currency">
          {SALARY_CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        {(["month", "year"] as const).map((p) => (
          <button key={p} className="chip min-h-9 px-3.5 text-sm" aria-pressed={period === p} onClick={() => setPeriod(p)}>
            {p === "month" ? "Monthly" : "Yearly"}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {salarySteps(currency, period).map((n) => (
          <button key={n} className="chip" aria-pressed={draft.salary?.min === n && draft.salary.currency === currency && draft.salary.period === period} onClick={() => pick(n)}>
            {formatAmount(n)}+
          </button>
        ))}
        <button className="chip" onClick={() => onAnswer({ salary: undefined, minSalary: "" })}>
          Any pay
        </button>
      </div>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (typed >= 1) pick(Math.round(typed));
        }}
      >
        <input className="field" value={other} onChange={(e) => setOther(e.target.value)} placeholder={`Other amount, e.g. ${formatAmount(salarySteps(currency, period)[1])}`} inputMode="numeric" aria-label="Other minimum amount" />
        <button className="btn btn-primary shrink-0" disabled={!(typed >= 1)}>
          Use this
        </button>
      </form>
    </div>
  );
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

function TextAnswer({
  initial,
  required,
  placeholder,
  list,
  onSubmit,
}: {
  initial: string;
  required: boolean;
  placeholder?: string;
  list?: string[];
  onSubmit: (v: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const ok = !required || value.trim().length >= 2;
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onSubmit(value.trim());
      }}
    >
      <input
        className="field"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        list={list ? "unemploy-countries" : undefined}
        autoFocus
        aria-label="Your answer"
      />
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
