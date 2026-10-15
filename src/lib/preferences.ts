import { z } from "zod";

export const WORK_SETTINGS = [
  { value: "onsite", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
] as const;

export const REMOTE_SCOPES = [
  { value: "country", label: "My country only" },
  { value: "region", label: "My region" },
  { value: "anywhere", label: "Anywhere in the world" },
] as const;

export const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Temporary", "Internship", "Freelance"] as const;

export const LEVELS = ["Internship", "Entry", "Associate", "Mid-Senior", "Director", "Executive"] as const;

// Rough cost model for one search, shown before users pick how many jobs a search brings. One base wake plus
// per-job research and writing. Tune from real ledger data once Minds are running.
export const COGNITION_USD = 2.83 / 160;
// Measured on real searches (Oct 2026): opening each posting and its form, reading them,
// writing the pack and sending costs far more than first guessed. The per-job figure is
// replaced by the headhunter's own history once it has some (see lib/cost.ts).
export const BASE_COGNITION_PER_SEARCH = 30;
export const DEFAULT_COGNITION_PER_JOB = 22;

// People answer "no" or "none" to "any companies to avoid?". Those aren't company names.
const NOTHING = new Set(["no", "none", "nope", "n/a", "na", "nil", "nothing", "-", "no one", "nobody"]);
export function avoidList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/[,\n;]/)
    .map((c) => c.trim())
    .filter((c) => c.length > 1 && !NOTHING.has(c.toLowerCase()));
}

// Postings older than this are likely filled or "ghost" listings. The default; each
// headhunter can be told to accept older ones (the coach suggests it when fresh leads run out).
export const MAX_POSTING_AGE_DAYS = 60; // the default; the brief and the landing page both quote it
export const POSTING_AGE_OPTIONS = [30, 45, 60, 90] as const;
export const postingAgeDays = (p: { maxPostingAgeDays?: number } | null | undefined) => p?.maxPostingAgeDays ?? MAX_POSTING_AGE_DAYS;

// A first headhunter has no label until the person says which roles they want.
export const PENDING_LABEL = "Headhunter";

export const JOBS_PER_DAY_OPTIONS = [3, 5, 10, 20] as const;

// The range users can pick for one search (slider).
export const MIN_JOBS_PER_SEARCH = 1;
export const MAX_JOBS_PER_SEARCH = 10;
export const RECOMMENDED_JOBS_PER_SEARCH = 5;

export function estimateSearchCost(jobsPerDay: number, perJob = DEFAULT_COGNITION_PER_JOB) {
  const cognition = Math.round(BASE_COGNITION_PER_SEARCH + perJob * jobsPerDay);
  return { cognition, usd: cognition * COGNITION_USD };
}

export const preferencesSchema = z.object({
  targetRoles: z.string().trim().min(2).max(300),
  country: z.string().trim().min(2).max(80),
  city: z.string().trim().max(80).optional().default(""),
  workSettings: z.array(z.enum(["onsite", "hybrid", "remote"])).min(1),
  remoteScope: z.enum(["country", "region", "anywhere"]).default("country"),
  jobTypes: z.array(z.enum(JOB_TYPES)).min(1),
  levels: z.array(z.enum(LEVELS)).default([]), // empty: match the resume
  avoidCompanies: z.string().trim().max(500).optional().default(""),
  needsVisa: z.boolean().default(false),
  jobsPerDay: z.number().int().min(1).max(MAX_JOBS_PER_SEARCH),
  maxPostingAgeDays: z.number().int().min(14).max(120).optional(),
});

export type Preferences = z.infer<typeof preferencesSchema>;

// Empty levels means "whatever my resume says": the level I'm at and one above.
export const levelText = (p: { levels: string[] }) => (p.levels.length ? p.levels.join(", ") : "Match my resume");

export function workSettingLabel(v: string) {
  return WORK_SETTINGS.find((w) => w.value === v)?.label ?? v;
}

export function summarizePreferences(p: Preferences): { label: string; value: string }[] {
  const place = [p.city, p.country].filter(Boolean).join(", ");
  const remote = p.workSettings.includes("remote");
  return [
    { label: "Looking for", value: p.targetRoles },
    { label: "Where", value: place },
    { label: "Work setting", value: p.workSettings.map(workSettingLabel).join(", ") },
    ...(remote ? [{ label: "Remote jobs from", value: REMOTE_SCOPES.find((r) => r.value === p.remoteScope)?.label ?? "Anywhere" }] : []),
    { label: "Job type", value: p.jobTypes.join(", ") },
    { label: "Level", value: levelText(p) },
    { label: "Avoid", value: avoidList(p.avoidCompanies).join(", ") || "None" },
    { label: "Visa sponsorship", value: p.needsVisa ? "Needed" : "Not needed" },
    { label: "Jobs per search", value: String(p.jobsPerDay) },
    { label: "Posted within", value: `${postingAgeDays(p)} days` },
  ];
}
