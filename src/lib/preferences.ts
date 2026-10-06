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

// Postings older than this are likely filled or "ghost" listings.
export const MAX_POSTING_AGE_DAYS = 45;

export const JOBS_PER_DAY_OPTIONS = [3, 5, 10, 20] as const;

// The range users can pick for one search (slider).
export const MIN_JOBS_PER_SEARCH = 1;
export const MAX_JOBS_PER_SEARCH = 20;
export const RECOMMENDED_JOBS_PER_SEARCH = 5;

export function estimateSearchCost(jobsPerDay: number, perJob = DEFAULT_COGNITION_PER_JOB) {
  const cognition = Math.round(BASE_COGNITION_PER_SEARCH + perJob * jobsPerDay);
  return { cognition, usd: cognition * COGNITION_USD };
}

// ---------- Pay ----------
// A floor, not an exact figure: "at least MYR 5,000 a month".

export type SalaryPeriod = "month" | "year";
export type SalaryFloor = { currency: string; min: number; period: SalaryPeriod };

const CURRENCY_BY_COUNTRY: Record<string, string> = {
  malaysia: "MYR", singapore: "SGD", indonesia: "IDR", thailand: "THB", philippines: "PHP", vietnam: "VND",
  "hong kong": "HKD", taiwan: "TWD", japan: "JPY", "south korea": "KRW", china: "CNY", india: "INR",
  pakistan: "PKR", bangladesh: "BDT", australia: "AUD", "new zealand": "NZD", "united arab emirates": "AED",
  "saudi arabia": "SAR", qatar: "QAR", bahrain: "BHD", "united kingdom": "GBP", "united states": "USD",
  canada: "CAD", mexico: "MXN", brazil: "BRL", switzerland: "CHF", sweden: "SEK", denmark: "DKK", norway: "NOK",
  poland: "PLN", "south africa": "ZAR", nigeria: "NGN", kenya: "KES", egypt: "EGP",
  ireland: "EUR", germany: "EUR", france: "EUR", netherlands: "EUR", spain: "EUR", italy: "EUR", portugal: "EUR", finland: "EUR",
};
export const currencyFor = (country = "") => CURRENCY_BY_COUNTRY[country.trim().toLowerCase()] ?? "USD";
export const SALARY_CURRENCIES = [...new Set(["MYR", "SGD", "USD", "EUR", "GBP", "AUD", ...Object.values(CURRENCY_BY_COUNTRY)])];

// Typical monthly steps per currency; yearly steps are these × 12.
const MONTHLY_STEPS: Record<string, number[]> = {
  MYR: [3000, 5000, 8000, 10000, 15000, 20000],
  SGD: [3000, 5000, 7000, 10000, 15000],
  USD: [3000, 5000, 8000, 10000, 15000],
  EUR: [2500, 4000, 6000, 8000, 10000],
  GBP: [2500, 4000, 5500, 7500, 10000],
  AUD: [5000, 7000, 9000, 12000, 15000],
  IDR: [8_000_000, 15_000_000, 25_000_000, 40_000_000],
  INR: [50_000, 100_000, 200_000, 300_000],
  PHP: [30_000, 60_000, 100_000, 150_000],
  THB: [30_000, 50_000, 80_000, 120_000],
  VND: [20_000_000, 40_000_000, 60_000_000],
  JPY: [300_000, 500_000, 700_000, 1_000_000],
};
export function salarySteps(currency: string, period: SalaryPeriod) {
  const m = MONTHLY_STEPS[currency] ?? MONTHLY_STEPS.USD;
  return period === "year" ? m.map((n) => n * 12) : m;
}

export const formatAmount = (n: number) => (n >= 1_000_000 && n % 100_000 === 0 ? `${n / 1_000_000}M` : n.toLocaleString("en-US"));
export const salaryLabel = (s: SalaryFloor) => `${s.currency} ${s.min.toLocaleString("en-US")}+ a ${s.period}`;

export const preferencesSchema = z.object({
  targetRoles: z.string().trim().min(2).max(300),
  country: z.string().trim().min(2).max(80),
  city: z.string().trim().max(80).optional().default(""),
  workSettings: z.array(z.enum(["onsite", "hybrid", "remote"])).min(1),
  remoteScope: z.enum(["country", "region", "anywhere"]).default("country"),
  jobTypes: z.array(z.enum(JOB_TYPES)).min(1),
  levels: z.array(z.enum(LEVELS)).min(1),
  minSalary: z.string().trim().max(60).optional().default(""), // readable; set from salary when chosen
  salary: z
    .object({ currency: z.string().trim().length(3), min: z.number().int().min(1).max(10_000_000_000), period: z.enum(["month", "year"]) })
    .optional(),
  avoidCompanies: z.string().trim().max(500).optional().default(""),
  needsVisa: z.boolean().default(false),
  jobsPerDay: z.number().int().min(1).max(50),
});

export type Preferences = z.infer<typeof preferencesSchema>;

export function workSettingLabel(v: string) {
  return WORK_SETTINGS.find((w) => w.value === v)?.label ?? v;
}

export function summarizePreferences(p: Preferences): { label: string; value: string }[] {
  const place = [p.city, p.country].filter(Boolean).join(", ");
  const remote = p.workSettings.includes("remote")
    ? ` · remote: ${REMOTE_SCOPES.find((r) => r.value === p.remoteScope)?.label.toLowerCase()}`
    : "";
  return [
    { label: "Looking for", value: p.targetRoles },
    { label: "Where", value: place },
    { label: "Work setting", value: p.workSettings.map(workSettingLabel).join(", ") + remote },
    { label: "Job type", value: p.jobTypes.join(", ") },
    { label: "Level", value: p.levels.join(", ") },
    { label: "Minimum salary", value: p.minSalary || "Not set" },
    { label: "Avoid", value: avoidList(p.avoidCompanies).join(", ") || "None" },
    { label: "Visa sponsorship", value: p.needsVisa ? "Needed" : "Not needed" },
    { label: "Jobs per search", value: String(p.jobsPerDay) },
  ];
}
