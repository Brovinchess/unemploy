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

// Rough cost model shown to users before they pick a daily volume. One base wake plus
// per-job research and writing. Tune from real ledger data once Minds are running.
export const COGNITION_USD = 2.83 / 160;
const BASE_COGNITION_PER_DAY = 15;
const COGNITION_PER_JOB = 8;

export const JOBS_PER_DAY_OPTIONS = [3, 5, 10, 20] as const;

export function estimateDailyCost(jobsPerDay: number) {
  const cognition = BASE_COGNITION_PER_DAY + COGNITION_PER_JOB * jobsPerDay;
  return { cognition, usd: cognition * COGNITION_USD };
}

export const preferencesSchema = z.object({
  targetRoles: z.string().trim().min(2).max(300),
  country: z.string().trim().min(2).max(80),
  city: z.string().trim().max(80).optional().default(""),
  workSettings: z.array(z.enum(["onsite", "hybrid", "remote"])).min(1),
  remoteScope: z.enum(["country", "region", "anywhere"]).default("country"),
  jobTypes: z.array(z.enum(JOB_TYPES)).min(1),
  levels: z.array(z.enum(LEVELS)).min(1),
  minSalary: z.string().trim().max(60).optional().default(""),
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
    { label: "Avoid", value: p.avoidCompanies || "None" },
    { label: "Visa sponsorship", value: p.needsVisa ? "Needed" : "Not needed" },
    { label: "Jobs per day", value: String(p.jobsPerDay) },
  ];
}
