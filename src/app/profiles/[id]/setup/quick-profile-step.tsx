"use client";

import { TitleInput } from "@/components/title-input";

import { useActionState, useMemo, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { saveQuickProfile } from "@/app/actions";
import { FormError } from "@/components/onboarding-shell";

// No resume? Three short cards: your job, what you're good at, and an optional bit more.
// Every field is optional, most are a tap, and the server writes a plain resume from whatever
// is filled in.

const YEARS = [
  ["0-1", "Under 2 years"],
  ["2-4", "2 to 4"],
  ["5-9", "5 to 9"],
  ["10+", "10 or more"],
] as const;
const DEGREES = [
  ["certificate", "Certificate"],
  ["diploma", "Diploma"],
  ["bachelor", "Bachelor's"],
  ["master", "Master's"],
  ["phd", "PhD"],
] as const;

// Skills offered as chips, by what the job title says. The last list is for everyone else.
const SKILLS: [RegExp, string[]][] = [
  [/product/i, ["Roadmaps", "User research", "Analytics", "SQL", "Figma", "Jira", "A/B testing", "Stakeholder management", "Agile", "Go-to-market"]],
  [/design/i, ["Figma", "Prototyping", "User research", "Design systems", "Usability testing", "Illustration", "Webflow", "Motion", "Branding"]],
  [/engineer|developer|programmer|software/i, ["JavaScript", "TypeScript", "React", "Python", "Java", "SQL", "AWS", "Docker", "Git", "APIs", "Testing"]],
  [/data|analyst|scientist/i, ["SQL", "Python", "Excel", "Tableau", "Power BI", "Statistics", "Machine learning", "dbt", "Dashboards"]],
  [/market/i, ["SEO", "Paid ads", "Content", "Email campaigns", "Analytics", "Social media", "Copywriting", "HubSpot", "Events"]],
  [/sales|account exec|business development/i, ["Prospecting", "Negotiation", "CRM", "Salesforce", "Pipeline management", "Presentations", "Closing", "Partnerships"]],
  [/project|program|delivery|scrum/i, ["Planning", "Jira", "Agile", "Scrum", "Budgets", "Risk management", "Stakeholder management", "Reporting"]],
  [/account|financ|audit/i, ["Excel", "Bookkeeping", "Financial reporting", "Budgeting", "SAP", "Tax", "Audit", "Forecasting"]],
  [/support|service|success/i, ["Customer service", "Zendesk", "Troubleshooting", "Onboarding", "Communication", "CRM", "Retention"]],
  [/hr|recruit|people|talent/i, ["Recruiting", "Interviewing", "Onboarding", "Payroll", "Employee relations", "LinkedIn Recruiter", "Training"]],
  [/operation|admin|office|logistic/i, ["Scheduling", "Vendor management", "Excel", "Process improvement", "Inventory", "Procurement", "Reporting"]],
  [/teach|tutor|trainer|lecturer/i, ["Lesson planning", "Curriculum", "Classroom management", "Assessment", "Online teaching", "Mentoring"]],
  [/nurse|doctor|clinic|pharma|care/i, ["Patient care", "Clinical documentation", "Medication", "Triage", "Electronic records", "Infection control"]],
  [/chef|cook|barista|restaurant|hotel|hospitality/i, ["Food preparation", "Food safety", "Customer service", "Inventory", "POS systems", "Team leading"]],
];
const GENERAL = ["Communication", "Teamwork", "Excel", "Presentations", "Planning", "Problem solving", "Customer service", "Time management"];

const years = Array.from({ length: 27 }, (_, i) => String(new Date().getFullYear() - i));

export function QuickProfileStep({ profileId }: { profileId: string }) {
  const [state, action, pending] = useActionState(saveQuickProfile.bind(null, profileId), undefined);
  const [title, setTitle] = useState("");
  const [yearsBand, setYearsBand] = useState("");
  const [degree, setDegree] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [more, setMore] = useState(false);
  const chips = useMemo(() => SKILLS.find(([re]) => re.test(title))?.[1] ?? GENERAL, [title]);
  const shown = [...chips, ...picked.filter((p) => !chips.includes(p))];
  const toggle = (s: string) => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  const addCustom = () => {
    const s = custom.trim();
    if (s && !picked.includes(s)) setPicked((p) => [...p, s]);
    setCustom("");
  };

  return (
    <form action={action} className="w-full space-y-4">
      <input type="hidden" name="years" value={yearsBand} />
      <input type="hidden" name="degree" value={degree} />
      <input type="hidden" name="skills" value={picked.join(", ")} />

      <Block n={1} title="Your job now" hint="Or your last one.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Job title" htmlFor="qp-title">
            <TitleInput id="qp-title" name="title" className="field h-12" placeholder="Marketing Manager" value={title} onChange={setTitle} />
          </Field>
          <Field label="Company" htmlFor="qp-company">
            <input id="qp-company" name="company" className="field h-12" placeholder="Target" autoComplete="organization" />
          </Field>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[9rem_1fr]">
          <Field label="Since" htmlFor="qp-since">
            <select id="qp-since" name="since" className="field h-12" defaultValue="">
              <option value="">Year</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Years doing this kind of work">
            <Pills options={YEARS} value={yearsBand} onChange={setYearsBand} />
          </Field>
        </div>
      </Block>

      <Block n={2} title="What you're good at" hint="Tap a few. Add your own if it's missing.">
        <div className="flex flex-wrap gap-2">
          {shown.map((s) => {
            const on = picked.includes(s);
            return (
              <button key={s} type="button" onClick={() => toggle(s)} aria-pressed={on} className={`inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors ${on ? "bg-coral text-white" : "bg-white/[0.06] text-white/75 ring-1 ring-white/10 hover:bg-white/[0.1] hover:text-white"}`}>
                {s}
                {on && <X className="size-3.5" aria-hidden />}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            className="field h-11 flex-1"
            placeholder="Something else you're good at"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
          />
          <button type="button" className="btn btn-ghost h-11 shrink-0 px-4" onClick={addCustom}>
            <Plus className="size-4" aria-hidden /> Add
          </button>
        </div>
      </Block>

      <Block n={3} title="A bit more" hint="All optional. Each line makes your applications a little stronger." open={more} onToggle={() => setMore((v) => !v)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="The job before" htmlFor="qp-prevTitle">
            <input id="qp-prevTitle" name="prevTitle" className="field h-12" placeholder="Marketing Coordinator" />
          </Field>
          <Field label="At" htmlFor="qp-prevCompany">
            <input id="qp-prevCompany" name="prevCompany" className="field h-12" placeholder="Best Buy" />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Something you're proud of" htmlFor="qp-proud" hint="One line. A number helps.">
            <input id="qp-proud" name="proud" className="field h-12" placeholder="Grew email sign-ups by 40% in a year" />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Education">
            <Pills options={DEGREES} value={degree} onChange={setDegree} allowNone />
          </Field>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input name="subject" className="field h-12" placeholder="Subject, like Business" />
            <input name="school" className="field h-12" placeholder="School, like Ohio State University" />
          </div>
        </div>
      </Block>

      <FormError message={state?.error} />
      <button className="btn btn-primary h-12 w-full" disabled={pending}>
        {pending ? "Writing your resume…" : "Write my resume"}
      </button>
      <p className="text-center text-sm text-muted">Skip anything you&rsquo;re not sure about. You can upload a real resume later and it takes over.</p>
    </form>
  );
}

function Block({ n, title, hint, children, open, onToggle }: { n: number; title: string; hint?: string; children: React.ReactNode; open?: boolean; onToggle?: () => void }) {
  const collapsible = onToggle !== undefined;
  return (
    <section className="rounded-3xl bg-white/[0.04] p-5 sm:p-6">
      <div className={`flex items-start gap-3 ${collapsible ? "cursor-pointer select-none" : ""}`} onClick={onToggle} role={collapsible ? "button" : undefined} aria-expanded={collapsible ? open : undefined}>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-coral/15 text-xs font-semibold text-rose">{n}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-medium text-white">{title}</h3>
          {hint && <p className="mt-0.5 text-sm text-white/50">{hint}</p>}
        </div>
        {collapsible && <ChevronDown className={`mt-1 size-4 text-white/45 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />}
      </div>
      {(!collapsible || open) && <div className="mt-5">{children}</div>}
    </section>
  );
}

// A caption over a control. Not a <label> wrapper: a label would send clicks on the pill
// buttons to the first button inside it.
function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-sm text-white/70">
        {label}
      </label>
      {hint && <span className="ml-2 text-xs text-white/40">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Pills({ options, value, onChange, allowNone = false }: { options: readonly (readonly [string, string])[]; value: string; onChange: (v: string) => void; allowNone?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, l]) => {
        const on = value === v;
        return (
          <button key={v} type="button" aria-pressed={on} onClick={() => onChange(on && allowNone ? "" : v)} className={`h-12 rounded-xl px-4 text-sm font-medium transition-colors ${on ? "bg-coral text-white" : "bg-white/[0.06] text-white/75 ring-1 ring-white/10 hover:bg-white/[0.1] hover:text-white"}`}>
            {l}
          </button>
        );
      })}
    </div>
  );
}
