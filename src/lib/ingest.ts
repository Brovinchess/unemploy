import "server-only";
import { and, count, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import type { Profile } from "@/db/schema";
import { SAME_ROLE_DAYS, SeenJobs } from "./dedupe";
import { clearlyBelow, floorOf } from "./pay";
import { avoidList, MAX_POSTING_AGE_DAYS, salaryLabel } from "./preferences";
import { isAboutTheJob, queueQuestions, similarity } from "./personal";
import { checkPosting, eligibilityProblem, hostOf, isAggregator } from "./quality";
import { endSearch, isSearching } from "./search";

const claimSchema = z.object({
  claim: z.string().trim().min(3).max(400),
  evidence: z.string().trim().min(3).max(400),
});

// Text that's merely too long is trimmed rather than costing the whole job.
const trimmed = (max: number) => z.string().trim().transform((s) => (s.length > max ? `${s.slice(0, max - 1)}…` : s));

const jobSchema = z.object({
  url: z.url({ protocol: /^https?$/ }),
  title: z.string().trim().min(2).max(200),
  company: z.string().trim().min(1).max(200),
  city: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  workSetting: z.enum(["onsite", "hybrid", "remote"]),
  jobType: z.string().trim().max(60).optional(),
  level: z.string().trim().max(60).optional(),
  salary: trimmed(120).optional(),
  postedAt: z.string().trim().max(40).optional(),
  matchScore: z.number().min(0).max(100),
  whyFit: z.string().trim().min(10).max(1200),
  gaps: z.array(z.string().trim().max(300)).max(10).default([]),
  companyNotes: z.string().trim().max(1500).optional(),
  // For the job card. The website gives us the company's logo.
  companyWebsite: z.string().trim().min(3).max(200),
  companyStage: z.string().trim().max(60).optional(),
  companySize: z.string().trim().max(60).optional(),
  industry: z.string().trim().max(80).optional(),
  perks: z.array(z.string().trim().min(2).max(60)).max(6).optional(),
  // Shown before the company is revealed; when missing, the card falls back to whyFit.
  highlights: z.array(trimmed(160)).max(3).optional(),
  summary: z.string().trim().min(10).max(200).optional(), // "what you'd do", one line
  salaryEstimated: z.boolean().optional(),
  // Evidence the Mind must bring from the posting itself.
  locationText: z.string().trim().min(3).max(400),
  mustHaves: z
    .array(z.object({ requirement: z.string().trim().min(3).max(300), met: z.boolean() }))
    .min(1)
    .max(12),
  verifiedOpenAt: z.string().trim().min(8).max(40),
  // The questions on the job's application form, so the personal Mind can answer them.
  formQuestions: z
    .array(
      z.object({
        question: trimmed(300),
        options: z.array(trimmed(120)).max(30).optional(),
        required: z.boolean().optional(),
      }),
    )
    .optional()
    .transform((qs) => qs?.filter((q) => q.question.length >= 3).slice(0, 40)),
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

export const pushSchema = z
  .object({ jobs: z.array(z.unknown()).max(50), final: z.boolean().optional() })
  .refine((b) => b.jobs.length > 0 || b.final, { message: "Send at least one job, or an empty list with final: true." });

export type JobPush = z.infer<typeof jobSchema>;

export type Rejection = { url?: string; code: string; hint: string };

export type PushResult = {
  accepted: number;
  rejected: Rejection[];
  remaining: number; // jobs still wanted in the current search
  remainingToday?: number; // older name for "remaining", kept for Minds briefed before
  searchEnded?: boolean;
  dryRun: boolean;
  // Changes the app made to accepted jobs (e.g. a match score capped), so the Mind learns.
  adjusted?: { url: string; note: string }[];
  // The user's recent skips, so the Mind learns without a separate (billed) message.
  skippedRecently?: { title: string; company: string; reason: string | null }[];
};

// Apostrophes and quotes vanish (curly or straight, and the "\uFFFD" left when a Mind's
// text arrives with a broken encoding); every other symbol is a space.
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’‛“”"'`´\uFFFD]/g, "")
    .replace(/[^\p{L}\p{N}%+#.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

// A quote counts as from the resume when it is, word for word, or when nearly all of its
// three-word runs appear there (PDF line breaks, bullets and dashes read differently).
function inResume(evidence: string, resume: string, resumeRuns: Set<string>) {
  const e = norm(evidence);
  if (!e) return false;
  if (resume.includes(e)) return true;
  const w = e.split(" ");
  if (w.length < 6) return false;
  let hit = 0;
  for (let i = 0; i + 3 <= w.length; i++) if (resumeRuns.has(w.slice(i, i + 3).join(" "))) hit++;
  return hit / (w.length - 2) >= 0.85;
}
function runsOf(text: string) {
  const w = text.split(" ");
  const out = new Set<string>();
  for (let i = 0; i + 3 <= w.length; i++) out.add(w.slice(i, i + 3).join(" "));
  return out;
}

const sameCountry = (a?: string, b?: string) => !!a && !!b && norm(a) === norm(b);

const MAX_UNVERIFIED_DAYS = 3;
const MAX_PER_COMPANY_PER_DAY = 2;
const MAX_SCORE_WITH_GAPS = 55;

function checkJob(job: JobPush, profile: Profile): Rejection | null {
  const prefs = profile.preferences!;
  const resume = norm(profile.resumeText ?? "");

  if (isAggregator(job.url)) {
    return {
      url: job.url,
      code: "not_employer_link",
      hint: `${hostOf(job.url)} copies postings and keeps them after they close. Find this job on the employer's own careers page or job system (Greenhouse, Lever, Ashby, Workday…) and send that link, or skip it.`,
    };
  }

  const seen = Date.parse(job.verifiedOpenAt);
  if (Number.isNaN(seen) || Date.now() - seen > MAX_UNVERIFIED_DAYS * 86_400_000 || seen - Date.now() > 86_400_000) {
    return {
      url: job.url,
      code: "not_verified",
      hint: `Open the posting today, confirm it still accepts applications, and send "verifiedOpenAt" as today's date.`,
    };
  }

  const eligibility = eligibilityProblem(job.locationText, prefs.country, prefs.city);
  if (eligibility) return { url: job.url, code: "not_eligible", hint: eligibility };

  const unmet = job.mustHaves.filter((m) => !m.met).length;
  if (unmet * 2 > job.mustHaves.length) {
    return {
      url: job.url,
      code: "poor_fit",
      hint: `The user misses ${unmet} of ${job.mustHaves.length} must-haves. Send jobs where they meet most of them.`,
    };
  }

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

  // Pay is a floor: a posted range passes if its top reaches it. Only pay the posting
  // states is held to it, and only when it's clearly below.
  const floor = floorOf(prefs);
  if (!job.salaryEstimated && floor && clearlyBelow(job.salary, floor)) {
    return {
      url: job.url,
      code: "below_salary",
      hint: `Posted pay "${job.salary}" is below the user's floor of ${salaryLabel(floor)}. Skip jobs whose whole range is under it.`,
    };
  }

  // Match whole words so "Meta" doesn't block "Metabase".
  const company = ` ${norm(job.company).replace(/[^a-z0-9]+/g, " ")} `;
  const avoid = avoidList(prefs.avoidCompanies).map((c) => ` ${norm(c).replace(/[^a-z0-9]+/g, " ").trim()} `);
  if (avoid.some((a) => a.trim() && company.includes(a))) {
    return { url: job.url, code: "company_avoided", hint: `The user asked to avoid ${job.company}.` };
  }

  if (job.postedAt) {
    const posted = Date.parse(job.postedAt);
    if (!Number.isNaN(posted) && Date.now() - posted > MAX_POSTING_AGE_DAYS * 86_400_000) {
      return {
        url: job.url,
        code: "stale_posting",
        hint: `Posted ${job.postedAt}, over ${MAX_POSTING_AGE_DAYS} days ago; it is probably filled. Send postings from the last ${MAX_POSTING_AGE_DAYS} days.`,
      };
    }
  }

  const runs = runsOf(resume);
  const unsupported = job.pack.claims.filter((c) => !inResume(c.evidence, resume, runs));
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
// "https://www.acme.com/careers" or "acme.com" → "acme.com"
function companyDomain(raw: string) {
  try {
    return new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function isPublicHttpUrl(raw: string) {
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


export async function processPush(profile: Profile, body: unknown, opts: { dryRun?: boolean; demo?: boolean } = {}): Promise<PushResult> {
  const result = await checkAndSave(profile, body, opts);
  // Pushes refused before any job was looked at are logged too: the log is where to look
  // when a headhunter goes quiet.
  if (!result.logged) {
    await db.insert(schema.ingestLog).values({ profileId: profile.id, accepted: 0, rejected: result.rejected.length, detail: result.rejected, dryRun: result.dryRun });
  }
  delete result.logged;
  return result;
}

async function checkAndSave(
  profile: Profile,
  body: unknown,
  opts: { dryRun?: boolean; demo?: boolean },
): Promise<PushResult & { logged?: boolean }> {
  const dryRun = !!opts.dryRun;
  const prefs = profile.preferences;
  if (!prefs || !profile.resumeText) {
    return {
      accepted: 0,
      rejected: [{ code: "profile_incomplete", hint: "This profile has no resume or preferences yet. Wait for setup." }],
      remaining: 0,
      dryRun,
    };
  }
  if (profile.status === "paused") {
    return {
      accepted: 0,
      rejected: [{ code: "paused", hint: "The user paused this headhunter. Stop searching until they resume it." }],
      remaining: 0,
      dryRun,
    };
  }

  // Searches happen only when the user asks. Test pushes are always allowed.
  if (!dryRun && !opts.demo && !isSearching(profile)) {
    return {
      accepted: 0,
      rejected: [
        {
          code: "no_search_requested",
          hint: "The user hasn't asked for a search. Only search after a SEARCH REQUEST message; stop now and wait.",
        },
      ],
      remaining: 0,
      dryRun,
    };
  }

  const parsed = pushSchema.safeParse(body);
  if (!parsed.success) {
    return {
      accepted: 0,
      rejected: [
        {
          code: "bad_body",
          hint: 'Body must be {"jobs":[ ... ], "final": true|false} with up to 50 jobs. See GET /api/ingest?brief=1.',
        },
      ],
      remaining: 0,
      dryRun,
    };
  }

  // The quota is per search; the per-company limit looks at the last day.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const searchStart = profile.searchStartedAt ?? since;
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.profileId, profile.id), gte(schema.jobs.createdAt, searchStart)));
  let remaining = Math.max(0, prefs.jobsPerDay - n);

  // Every job this user has been sent, to recognise repeats.
  const sent = await db
    .select({ url: schema.jobs.url, company: schema.jobs.company, title: schema.jobs.title, createdAt: schema.jobs.createdAt, profileId: schema.jobs.profileId })
    .from(schema.jobs)
    .innerJoin(schema.profiles, eq(schema.jobs.profileId, schema.profiles.id))
    .where(eq(schema.profiles.userId, profile.userId));
  const mine = new SeenJobs(sent.filter((j) => j.profileId === profile.id));
  const others = new SeenJobs(sent.filter((j) => j.profileId !== profile.id));

  const rejected: Rejection[] = [];
  const adjusted: { url: string; note: string }[] = [];
  const sentToday = new Map<string, number>(); // company -> accepted in this push
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

    // The same posting can come back under another link (tracking, old and new job-board
    // addresses, "/apply") or as the same role at the same company.
    const repeat = mine.match(job);
    if (repeat) {
      rejected.push({
        url: job.url,
        code: "duplicate",
        hint:
          repeat === "link"
            ? "Already sent. Only send new jobs."
            : `You sent "${job.title}" at ${job.company} in the last ${SAME_ROLE_DAYS} days. Only send new jobs.`,
      });
      continue;
    }

    // The same user may run several headhunters with overlapping searches; show each
    // posting once, in whichever shortlist got it first.
    if (others.match(job)) {
      rejected.push({
        url: job.url,
        code: "found_by_other_headhunter",
        hint: "The user's other headhunter already sent this job. Skip it and look for different ones.",
      });
      continue;
    }

    if (remaining <= 0) {
      rejected.push({
        url: job.url,
        code: "search_limit",
        hint: `The user asked for ${prefs.jobsPerDay} jobs per search and this search's are in. Stop and wait for the next request.`,
      });
      continue;
    }

    const sameCompany = await db
      .select({ n: count() })
      .from(schema.jobs)
      .where(and(eq(schema.jobs.profileId, profile.id), eq(schema.jobs.company, job.company), gte(schema.jobs.createdAt, since)));
    if (sameCompany[0].n + (sentToday.get(job.company.toLowerCase()) ?? 0) >= MAX_PER_COMPANY_PER_DAY) {
      rejected.push({
        url: job.url,
        code: "company_limit",
        hint: `Already ${MAX_PER_COMPANY_PER_DAY} jobs from ${job.company} today. Pick the single best-fitting role there and look at other companies.`,
      });
      continue;
    }

    if (!opts.demo && (await checkPosting(job.url, isPublicHttpUrl)) === "closed") {
      rejected.push({
        url: job.url,
        code: "job_closed",
        hint: "The posting is closed (404, redirected away, or says it no longer accepts applications). Only send open postings.",
      });
      continue;
    }

    // A missed must-have caps the score: a strong-sounding match that fails a hard
    // requirement wastes the user's time.
    if (job.mustHaves.some((m) => !m.met) && job.matchScore > MAX_SCORE_WITH_GAPS) {
      adjusted.push({ url: job.url, note: `matchScore capped at ${MAX_SCORE_WITH_GAPS} because a must-have is not met.` });
      job.matchScore = MAX_SCORE_WITH_GAPS;
    }
    sentToday.set(job.company.toLowerCase(), (sentToday.get(job.company.toLowerCase()) ?? 0) + 1);

    // Questions about the job or the fit are the Mind's to answer, in the form's own words,
    // so the extension can fill them. Accept the job, but point out any it skipped.
    const unanswered = (job.formQuestions ?? []).filter(
      (f) => isAboutTheJob(f.question) && !job.pack.answers.some((a) => similarity(f.question, a.question) >= 0.5),
    );
    if (unanswered.length) {
      adjusted.push({
        url: job.url,
        note: `pack.answers is missing answers for questions about the job or your fit: ${unanswered.map((f) => `"${f.question.slice(0, 80)}"`).join("; ")}. Next time include one for each, using the form's exact wording.`,
      });
    }

    remaining--;
    accepted++;
    mine.add({ url: job.url, company: job.company, title: job.title, createdAt: new Date() });
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
      companyDomain: companyDomain(job.companyWebsite),
      companyStage: job.companyStage,
      companySize: job.companySize,
      industry: job.industry,
      perks: job.perks ?? [],
      highlights: job.highlights?.filter((h) => h.length >= 5) ?? [],
      summary: job.summary ?? null,
      formQuestions: job.formQuestions ?? null,
      salaryEstimated: !!job.salary && !!job.salaryEstimated,
      locationText: job.locationText,
      mustHaves: job.mustHaves,
      verifiedAt: new Date(Date.parse(job.verifiedOpenAt)),
      lastCheckedAt: new Date(),
      demo: !!opts.demo,
    });
    await db.insert(schema.packs).values({ jobId: id, ...job.pack });
    if (job.formQuestions?.length) {
      await queueQuestions(profile.userId, job.company, job.formQuestions, job.pack.answers).catch((e) =>
        console.error("[ingest] queue questions failed", profile.id, e),
      );
    }
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

  // The search is over when the Mind says so or the quota is filled; switch the Mind off.
  let searchEnded = false;
  if (!dryRun && !opts.demo && (parsed.data.final || remaining <= 0)) {
    await endSearch(profile);
    searchEnded = true;
  }

  return { accepted, rejected, remaining, remainingToday: remaining, searchEnded, dryRun, adjusted, skippedRecently, logged: true };
}
