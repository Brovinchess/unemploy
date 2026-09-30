import "server-only";
import { and, count, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import type { Profile } from "@/db/schema";

const claimSchema = z.object({
  claim: z.string().trim().min(3).max(400),
  evidence: z.string().trim().min(3).max(400),
});

const jobSchema = z.object({
  url: z.url({ protocol: /^https?$/ }),
  title: z.string().trim().min(2).max(200),
  company: z.string().trim().min(1).max(200),
  city: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  workSetting: z.enum(["onsite", "hybrid", "remote"]),
  jobType: z.string().trim().max(60).optional(),
  level: z.string().trim().max(60).optional(),
  salary: z.string().trim().max(120).optional(),
  postedAt: z.string().trim().max(40).optional(),
  matchScore: z.number().min(0).max(100),
  whyFit: z.string().trim().min(10).max(1200),
  gaps: z.array(z.string().trim().max(300)).max(10).default([]),
  companyNotes: z.string().trim().max(1500).optional(),
  pack: z.object({
    coverLetter: z.string().trim().min(80).max(6000),
    aboutMe: z.string().trim().min(20).max(1500),
    answers: z
      .array(z.object({ question: z.string().trim().min(3).max(500), answer: z.string().trim().min(1).max(3000) }))
      .max(20)
      .default([]),
    claims: z.array(claimSchema).min(1).max(40),
  }),
});

export const pushSchema = z.object({ jobs: z.array(z.unknown()).min(1).max(50) });

export type JobPush = z.infer<typeof jobSchema>;

export type Rejection = { url?: string; code: string; hint: string };

export type PushResult = {
  accepted: number;
  rejected: Rejection[];
  remainingToday: number;
  dryRun: boolean;
  // The user's recent skips, so the Mind learns without a separate (billed) message.
  skippedRecently?: { title: string; company: string; reason: string | null }[];
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’“”"'`]/g, "")
    .replace(/[^\p{L}\p{N}%+#.]+/gu, " ")
    .trim();

const sameCountry = (a?: string, b?: string) => !!a && !!b && norm(a) === norm(b);

function checkJob(job: JobPush, profile: Profile): Rejection | null {
  const prefs = profile.preferences!;
  const resume = norm(profile.resumeText ?? "");

  if (!prefs.workSettings.includes(job.workSetting)) {
    return {
      url: job.url,
      code: "work_setting_not_wanted",
      hint: `This user only wants: ${prefs.workSettings.join(", ")}. Skip ${job.workSetting} jobs.`,
    };
  }

  const needsHomeCountry = job.workSetting !== "remote" || prefs.remoteScope === "country";
  if (needsHomeCountry && !sameCountry(job.country, prefs.country)) {
    return {
      url: job.url,
      code: "wrong_country",
      hint: `Job must be in ${prefs.country} (got "${job.country ?? "missing"}"). Always send "country" as the full country name.`,
    };
  }

  const avoid = prefs.avoidCompanies
    .split(/[,\n]/)
    .map((c) => norm(c))
    .filter(Boolean);
  if (avoid.some((a) => norm(job.company).includes(a))) {
    return { url: job.url, code: "company_avoided", hint: `The user asked to avoid ${job.company}.` };
  }

  const unsupported = job.pack.claims.filter((c) => !resume.includes(norm(c.evidence)));
  if (unsupported.length) {
    return {
      url: job.url,
      code: "claim_not_in_resume",
      hint:
        `Every claim needs "evidence" copied word for word from the resume. Not found: ` +
        unsupported.map((c) => `"${c.evidence.slice(0, 80)}"`).join("; ") +
        `. Remove the claim from the pack or quote the resume exactly.`,
    };
  }

  return null;
}

// Job links come from the Mind, so never let the check reach private or internal addresses.
function isPublicHttpUrl(raw: string) {
  const u = new URL(raw);
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return false;
  if (/^\[.*\]$/.test(h)) return false; // IPv6 literals
  const ip = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ip) {
    const [a, b] = [Number(ip[1]), Number(ip[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) {
      return false;
    }
  }
  return true;
}

async function linkIsDead(url: string): Promise<boolean> {
  try {
    // No redirect following: a redirect means the page exists somewhere, and following it
    // could lead to an internal address.
    const res = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(6000) });
    return res.status === 404 || res.status === 410;
  } catch {
    // Network errors and bot walls are not proof the posting is gone.
    return false;
  }
}

export async function processPush(
  profile: Profile,
  body: unknown,
  opts: { dryRun?: boolean; demo?: boolean } = {},
): Promise<PushResult> {
  const dryRun = !!opts.dryRun;
  const prefs = profile.preferences;
  if (!prefs || !profile.resumeText) {
    return {
      accepted: 0,
      rejected: [{ code: "profile_incomplete", hint: "This profile has no resume or preferences yet. Wait for setup." }],
      remainingToday: 0,
      dryRun,
    };
  }
  if (profile.status === "paused") {
    return {
      accepted: 0,
      rejected: [{ code: "paused", hint: "The user paused this headhunter. Stop searching until they resume it." }],
      remainingToday: 0,
      dryRun,
    };
  }

  const parsed = pushSchema.safeParse(body);
  if (!parsed.success) {
    return {
      accepted: 0,
      rejected: [{ code: "bad_body", hint: 'Body must be {"jobs":[ ... ]} with 1–50 jobs. See GET /api/ingest?brief=1.' }],
      remainingToday: 0,
      dryRun,
    };
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.profileId, profile.id), gte(schema.jobs.createdAt, since)));
  let remaining = Math.max(0, prefs.jobsPerDay - n);

  const rejected: Rejection[] = [];
  let accepted = 0;

  for (const raw of parsed.data.jobs) {
    const r = jobSchema.safeParse(raw);
    if (!r.success) {
      const url = typeof raw === "object" && raw && "url" in raw ? String((raw as { url: unknown }).url) : undefined;
      rejected.push({
        url,
        code: "bad_job",
        hint: r.error.issues.map((i) => `${i.path.join(".") || "job"}: ${i.message}`).join("; "),
      });
      continue;
    }
    const job = r.data;

    if (!isPublicHttpUrl(job.url)) {
      rejected.push({ url: job.url, code: "bad_url", hint: "Job links must be public http(s) addresses." });
      continue;
    }

    const problem = checkJob(job, profile);
    if (problem) {
      rejected.push(problem);
      continue;
    }

    const existing = await db.query.jobs.findFirst({
      where: and(eq(schema.jobs.profileId, profile.id), eq(schema.jobs.url, job.url)),
      columns: { id: true },
    });
    if (existing) {
      rejected.push({ url: job.url, code: "duplicate", hint: "Already sent. Only send new jobs." });
      continue;
    }

    if (remaining <= 0) {
      rejected.push({
        url: job.url,
        code: "daily_limit",
        hint: `The user asked for ${prefs.jobsPerDay} jobs a day and today's are in. Send only your best; stop until tomorrow.`,
      });
      continue;
    }

    if (!opts.demo && (await linkIsDead(job.url))) {
      rejected.push({ url: job.url, code: "job_link_dead", hint: "The job link returns 404/410. Only send live postings." });
      continue;
    }

    remaining--;
    accepted++;
    if (dryRun) continue;

    const id = crypto.randomUUID();
    await db.insert(schema.jobs).values({
      id,
      profileId: profile.id,
      url: job.url,
      title: job.title,
      company: job.company,
      city: job.city,
      country: job.country,
      workSetting: job.workSetting,
      jobType: job.jobType,
      level: job.level,
      salary: job.salary,
      postedAt: job.postedAt,
      matchScore: job.matchScore,
      whyFit: job.whyFit,
      gaps: job.gaps,
      companyNotes: job.companyNotes,
      demo: !!opts.demo,
    });
    await db.insert(schema.packs).values({ jobId: id, ...job.pack });
  }

  await db.insert(schema.ingestLog).values({
    profileId: profile.id,
    accepted,
    rejected: rejected.length,
    detail: rejected,
    dryRun,
  });
  if (accepted > 0 && !dryRun) {
    await db.update(schema.profiles).set({ lastDeliveryAt: new Date() }).where(eq(schema.profiles.id, profile.id));
  }

  const skippedRecently = await db
    .select({ title: schema.jobs.title, company: schema.jobs.company, reason: schema.jobs.skipReason })
    .from(schema.jobs)
    .where(
      and(
        eq(schema.jobs.profileId, profile.id),
        eq(schema.jobs.status, "skipped"),
        gte(schema.jobs.statusChangedAt, new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)),
      ),
    )
    .limit(20);

  return { accepted, rejected, remainingToday: remaining, dryRun, skippedRecently };
}
