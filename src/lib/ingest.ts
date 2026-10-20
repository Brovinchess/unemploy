import "server-only";
import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import type { Profile } from "@/db/schema";
import { companyKey, jobKey, SAME_ROLE_DAYS, SeenJobs, titleKey } from "./dedupe";
import { avoidList, postingAgeDays } from "./preferences";
import { countryCodeOf, jobTypeKeyOf, levelKeyOf, postedOnOf } from "./normalise";
import { isAboutTheJob, queueQuestions, similarity } from "./personal";
import { humanise } from "./text";
import { checkPosting, eligibilityProblem, hostOf, isAggregator } from "./quality";
import { endSearch, isSearching, jobsNeedingPacks, switchOff } from "./search";

// Jobs that arrive this soon after a "final" still count: the Mind finished its last reads.
const LATE_GRACE_MS = 30 * 60 * 1000;

// Long text is cut, not refused: a too-long field is paperwork, not a reason to lose a job.
const trimmed = (max: number) => z.string().trim().transform((s) => (s.length > max ? `${s.slice(0, max - 1)}…` : s));

const claimSchema = z.object({
  claim: trimmed(400),
  evidence: trimmed(400),
});

// The facts about a posting itself, shared by a sent job and by a lead the Mind opened and
// dropped: these are what the shared postings pool keeps. Nothing about the person.
const postingFields = {
  url: z.url({ protocol: /^https?$/ }),
  title: trimmed(200).pipe(z.string().min(2)),
  company: trimmed(200).pipe(z.string().min(1)),
  city: trimmed(120).optional(),
  country: trimmed(120).optional(),
  workSetting: z.enum(["onsite", "hybrid", "remote"]),
  jobType: trimmed(60).optional(),
  level: trimmed(60).optional(),
  salary: trimmed(120).optional(),
  postedAt: trimmed(40).optional(),
  companyWebsite: trimmed(200).optional(),
  companyStage: trimmed(60).optional(),
  companySize: trimmed(60).optional(),
  industry: trimmed(80).optional(),
  perks: z.array(trimmed(60)).max(6).optional(),
  summary: trimmed(200).optional(),
  salaryEstimated: z.boolean().optional(),
  locationText: trimmed(400).pipe(z.string().min(3)),
};
// For a dropped lead the requirements may come as plain strings or as the job shape.
const postingSchema = z.object({
  ...postingFields,
  mustHaves: z
    .array(z.union([trimmed(300), z.object({ requirement: trimmed(300), met: z.boolean().optional() })]))
    .max(12)
    .default([]),
});
export type PostingPush = z.infer<typeof postingSchema>;

const formQuestionsSchema = z
  .array(
    z.object({
      question: trimmed(300),
      options: z.array(trimmed(120)).max(30).optional(),
      required: z.boolean().optional(),
    }),
  )
  .optional()
  .transform((qs) => qs?.filter((q) => q.question.length >= 3).slice(0, 40));
const packSchema = z.object({
  coverLetter: trimmed(6000).pipe(z.string().min(40)),
  aboutMe: trimmed(1500).pipe(z.string().min(10)),
  answers: z
    .array(z.object({ question: trimmed(500), answer: trimmed(3000) }))
    .default([])
    .transform((a) => a.slice(0, 40)),
  claims: z.array(claimSchema).max(40).default([]),
});

// Text that's merely too long is trimmed rather than costing the whole job.
const jobSchema = z.object({
  ...postingFields,
  matchScore: z.number().min(0).max(100).catch(50),
  whyFit: trimmed(1200).optional(), // falls back to the summary
  gaps: z.array(trimmed(300)).max(10).default([]),
  companyNotes: trimmed(1500).optional(),
  // Shown before the company is revealed; when missing, the card falls back to whyFit.
  highlights: z.array(trimmed(160)).max(3).optional(),
  mustHaves: z
    .array(z.object({ requirement: trimmed(300), met: z.boolean() }))
    .max(12)
    .default([]),
  verifiedOpenAt: trimmed(40).optional(),
  // The questions on the job's application form, so the ones about the person can be answered once.
  formQuestions: formQuestionsSchema,
  // Normally absent: packs are written later, for the jobs the person keeps (see packPushSchema).
  pack: packSchema.optional(),
});

// A pack for a job already on the board, sent after a PACK REQUEST.
const packPushSchema = z.object({ url: trimmed(2000), formQuestions: formQuestionsSchema, pack: packSchema });
type Pack = z.infer<typeof packSchema>;

export const DROP_REASONS = ["not_eligible", "too_old", "closed", "poor_fit", "duplicate", "work_setting", "unreachable", "other"] as const;
// Minds briefed before pay stopped being a reason still send it: keep the lead, file it under other.
const reasonSchema = z.enum([...DROP_REASONS, "pay"]).transform((r) => (r === "pay" ? "other" : r));
// Reasons that are about the person, not the posting: the posting may suit someone else.
// Too old, closed and unreachable postings never enter the pool.
const POOLABLE_REASONS = new Set<string>(["poor_fit", "not_eligible", "work_setting", "duplicate"]);
const droppedSchema = z.object({
  company: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(160),
  url: z.string().trim().max(500).optional(),
  reason: reasonSchema,
  note: z.string().trim().max(200).optional(),
  // The posting's facts, when the Mind opened it before dropping it. A malformed one is
  // ignored rather than losing the lead.
  posting: postingSchema.optional().catch(undefined),
});
type Dropped = z.infer<typeof droppedSchema>;

// Dropped items are validated one by one later, so one bad lead never costs the whole push.
export const pushSchema = z
  .object({ jobs: z.array(z.unknown()).max(50).default([]), final: z.boolean().optional(), dropped: z.array(z.unknown()).max(100).optional(), packs: z.array(z.unknown()).max(50).optional() })
  .refine((b) => b.jobs.length > 0 || b.final || (b.dropped?.length ?? 0) > 0 || (b.packs?.length ?? 0) > 0, { message: "Send at least one job, a packs list, a dropped list, or an empty list with final: true." });

export type JobPush = z.infer<typeof jobSchema>;

export type Rejection = { url?: string; code: string; hint: string };

export type PushResult = {
  accepted: number;
  rejected: Rejection[];
  remaining: number; // jobs still wanted in the current search
  remainingToday?: number; // older name for "remaining", kept for Minds briefed before
  searchEnded?: boolean;
  packsAccepted?: number;
  packsRejected?: Rejection[];
  droppedRecorded?: number;
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

const sameCountry = (a?: string, b?: string) => {
  if (!a || !b) return false;
  const ca = countryCodeOf(a), cb = countryCodeOf(b);
  return ca && cb ? ca === cb : norm(a) === norm(b);
};

const MAX_SCORE_WITH_GAPS = 55;

// One row per posting in the shared pool. Facts only, newest wins, the row never says who
// found it. Sources only upgrade: a lead someone dropped becomes "accepted" once anyone's
// headhunter sends it as a job. Skipped for demo and dry runs.
const SOURCE_RANK: Record<schema.PostingSource, number> = { dropped_lead: 0, quota_refused: 1, accepted: 2 };
export async function upsertPosting(p: PostingPush, source: schema.PostingSource, opts: { verifiedOpenAt?: string | null; demo?: boolean } = {}) {
  if (opts.demo) return null;
  if (!isPublicHttpUrl(p.url) || isAggregator(p.url)) return null;
  const key = jobKey(p.url);
  const now = new Date();
  const verified = opts.verifiedOpenAt && !Number.isNaN(Date.parse(opts.verifiedOpenAt)) ? new Date(Date.parse(opts.verifiedOpenAt)) : null;
  const row = {
    postingKey: key,
    url: p.url,
    title: p.title,
    company: p.company,
    companyKey: companyKey(p.company),
    city: p.city ?? null,
    country: p.country ?? null,
    countryCode: countryCodeOf(p.country, p.locationText),
    workSetting: p.workSetting,
    jobType: p.jobType ?? null,
    jobTypeKey: jobTypeKeyOf(p.jobType),
    level: p.level ?? null,
    levelKey: levelKeyOf(p.level ?? p.title),
    salary: p.salary ?? null,
    salaryEstimated: !!p.salary && !!p.salaryEstimated,
    postedAt: p.postedAt ?? null,
    postedOn: postedOnOf(p.postedAt),
    locationText: p.locationText,
    summary: p.summary ?? null,
    mustHaves: p.mustHaves.map((m) => (typeof m === "string" ? m : m.requirement)).filter(Boolean),
    companyDomain: p.companyWebsite ? companyDomain(p.companyWebsite) : null,
    companyStage: p.companyStage ?? null,
    companySize: p.companySize ?? null,
    industry: p.industry ?? null,
    perks: p.perks ?? null,
    source,
    demo: false,
    firstSeenAt: now,
    lastSeenAt: now,
    lastVerifiedOpenAt: verified,
    closedAt: null,
  };
  const ex = schema.postings;
  const keep = (col: { name: string }) => sql.raw(`coalesce(excluded."${col.name}", "postings"."${col.name}")`);
  await db
    .insert(schema.postings)
    .values(row)
    .onConflictDoUpdate({
      target: ex.postingKey,
      set: {
        url: sql`excluded.url`,
        title: sql`excluded.title`,
        company: sql`excluded.company`,
        companyKey: sql`excluded.company_key`,
        city: keep(ex.city),
        country: keep(ex.country),
        countryCode: keep(ex.countryCode),
        workSetting: keep(ex.workSetting),
        jobType: keep(ex.jobType),
        jobTypeKey: keep(ex.jobTypeKey),
        level: keep(ex.level),
        levelKey: keep(ex.levelKey),
        salary: keep(ex.salary),
        salaryEstimated: sql`case when excluded.salary is null then "postings".salary_estimated else excluded.salary_estimated end`,
        postedAt: keep(ex.postedAt),
        postedOn: keep(ex.postedOn),
        locationText: keep(ex.locationText),
        summary: keep(ex.summary),
        mustHaves: sql`case when jsonb_array_length(excluded.must_haves) > 0 then excluded.must_haves else "postings".must_haves end`,
        companyDomain: keep(ex.companyDomain),
        companyStage: keep(ex.companyStage),
        companySize: keep(ex.companySize),
        industry: keep(ex.industry),
        perks: keep(ex.perks),
        source: sql.raw(`case when ${SOURCE_RANK[source]} >= case "postings".source when 'accepted' then 2 when 'quota_refused' then 1 else 0 end then excluded.source else "postings".source end`),
        lastSeenAt: now,
        lastVerifiedOpenAt: sql`greatest(excluded.last_verified_open_at, "postings".last_verified_open_at)`,
        // Only a job someone's Mind just verified open clears a closed mark; a dropped lead doesn't prove it's open.
        closedAt: source === "accepted" ? null : sql`"postings".closed_at`,
      },
    });
  return key;
}

function checkJob(job: JobPush, profile: Profile): Rejection | null {
  const prefs = profile.preferences!;

  if (isAggregator(job.url)) {
    return {
      url: job.url,
      code: "not_employer_link",
      hint: `${hostOf(job.url)} copies postings and keeps them after they close. Find this job on the employer's own careers page or job system (Greenhouse, Lever, Ashby, Workday…) and send that link, or skip it.`,
    };
  }

  const eligibility = eligibilityProblem(job.locationText, prefs.country, prefs.city);
  // An on-site or hybrid job in the person's own country is fine even when its location line
  // names only an office or a city; the strict line check is for remote jobs.
  const onSiteAtHome = job.workSetting !== "remote" && sameCountry(job.country, prefs.country) && !!eligibility && eligibility.startsWith("The location line doesn't say");
  if (eligibility && !onSiteAtHome) return { url: job.url, code: "not_eligible", hint: eligibility };

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

  // Match whole words so "Meta" doesn't block "Metabase".
  const company = ` ${norm(job.company).replace(/[^a-z0-9]+/g, " ")} `;
  const avoid = avoidList(prefs.avoidCompanies).map((c) => ` ${norm(c).replace(/[^a-z0-9]+/g, " ").trim()} `);
  if (avoid.some((a) => a.trim() && company.includes(a))) {
    return { url: job.url, code: "company_avoided", hint: `The user asked to avoid ${job.company}.` };
  }

  if (job.postedAt) {
    const posted = Date.parse(job.postedAt);
    const maxAge = postingAgeDays(prefs);
    if (!Number.isNaN(posted) && Date.now() - posted > maxAge * 86_400_000) {
      return {
        url: job.url,
        code: "stale_posting",
        hint: `Posted ${job.postedAt}, over ${maxAge} days ago; it is probably filled. Send postings from the last ${maxAge} days.`,
      };
    }
  }

  return null;
}

// Claims whose "evidence" isn't in the resume. The job is still accepted; these are dropped
// from the pack so nothing invented reaches an application.
function unsupportedClaims(pack: Pack, profile: Profile) {
  const resume = norm(profile.resumeText ?? "");
  const runs = runsOf(resume);
  return pack.claims.filter((c) => !inResume(c.evidence, resume, runs));
}

// Saves a pack (new or rewritten) with the writing cleaned up.
async function storePack(jobId: string, pack: Pack) {
  const row = { jobId, ...pack, coverLetter: humanise(pack.coverLetter), aboutMe: humanise(pack.aboutMe), answers: pack.answers.map((a) => ({ ...a, answer: humanise(a.answer) })), updatedAt: new Date() };
  await db.insert(schema.packs).values(row).onConflictDoUpdate({ target: schema.packs.jobId, set: row });
}

// Claims without resume evidence are dropped; questions about the job the Mind left
// unanswered are pointed out. Returns one note for the reply, or null.
function checkPack(pack: Pack, formQuestions: { question: string }[], profile: Profile): string | null {
  const notes: string[] = [];
  const unsupported = unsupportedClaims(pack, profile);
  if (unsupported.length) {
    pack.claims = pack.claims.filter((c) => !unsupported.includes(c));
    notes.push(`Dropped ${unsupported.length} claim(s) whose evidence isn't in the resume word for word: ${unsupported.map((c) => `"${c.evidence.slice(0, 60)}"`).join("; ")}. Quote the resume exactly next time (answers taken from ABOUT ME need no claim).`);
  }
  // Questions about the job or the fit are the Mind's to answer, in the form's own words,
  // so the extension can fill them.
  const unanswered = formQuestions.filter((f) => isAboutTheJob(f.question) && !pack.answers.some((a) => similarity(f.question, a.question) >= 0.5));
  if (unanswered.length) notes.push(`pack.answers is missing answers for questions about the job or your fit: ${unanswered.map((f) => `"${f.question.slice(0, 80)}"`).join("; ")}. Next time include one for each, using the form's exact wording.`);
  return notes.length ? notes.join(" ") : null;
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
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
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

  const parsed = pushSchema.safeParse(body);
  if (!parsed.success) {
    return {
      accepted: 0,
      rejected: [
        {
          code: "bad_body",
          hint: 'Body must be a JSON object: {"jobs":[ ... ], "dropped":[ ... ], "packs":[ ... ], "final": true|false}. Each key is optional; up to 50 jobs, up to 100 dropped leads with a valid "reason", up to 50 packs. See GET /api/ingest?brief=1.',
        },
      ],
      remaining: 0,
      dryRun,
    };
  }

  // Searches happen only when the user asks. Test pushes are always allowed. A Mind that said
  // "final" too early and then sends jobs a few minutes later gets them accepted (they passed
  // every check and the user paid for them) and is told to stop; anything later is refused.
  const late =
    !isSearching(profile) && !!profile.searchEndedAt && Date.now() - profile.searchEndedAt.getTime() < LATE_GRACE_MS && parsed.data.jobs.length > 0;
  // Packs are written on request, between searches too, so a packs-only push is always taken.
  const packsOnly = parsed.data.jobs.length === 0 && !parsed.data.dropped?.length && !parsed.data.final && (parsed.data.packs?.length ?? 0) > 0;
  if (!dryRun && !opts.demo && !isSearching(profile) && !late && !packsOnly) {
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

  // The quota is per search.
  const searchStart = profile.searchStartedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  // The open search row: jobs and leads are tied to it, and pool hits are counted on it.
  const openSearch = dryRun
    ? null
    : await db.query.searches.findFirst({
        where: and(eq(schema.searches.profileId, profile.id), isNull(schema.searches.endedAt)),
        columns: { id: true, startedAt: true },
      });
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
      // Passed every per-user check, just late. Worth keeping for the pool once we've seen it open ourselves.
      if (!dryRun && !opts.demo && (await checkPosting(job.url, isPublicHttpUrl)) !== "closed") {
        await upsertPosting(job, "quota_refused", { verifiedOpenAt: job.verifiedOpenAt, demo: opts.demo }).catch((e) => console.error("[ingest] pool", e));
      }
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
    if (job.pack) {
      const note = checkPack(job.pack, job.formQuestions ?? [], profile);
      if (note) adjusted.push({ url: job.url, note });
    }

    mine.add({ url: job.url, company: job.company, title: job.title, createdAt: new Date() });
    if (dryRun) {
      remaining--;
      accepted++;
      continue;
    }

    const id = crypto.randomUUID();
    // Was this posting in the pool before the search began? Then it came through rung 0.
    const pooledBefore =
      !opts.demo && openSearch
        ? await db.query.postings
            .findFirst({ where: eq(schema.postings.postingKey, jobKey(job.url)), columns: { firstSeenAt: true } })
            .then((p) => !!p && p.firstSeenAt < openSearch.startedAt)
            .catch(() => false)
        : false;
    const postingKey = opts.demo ? null : await upsertPosting(job, "accepted", { verifiedOpenAt: job.verifiedOpenAt, demo: opts.demo }).catch((e) => (console.error("[ingest] pool", e), null));
    const inserted = await db.insert(schema.jobs).values({
      id,
      profileId: profile.id,
      postingKey,
      searchId: openSearch?.id ?? null,
      fromPool: pooledBefore,
      countryCode: countryCodeOf(job.country, job.locationText),
      jobTypeKey: jobTypeKeyOf(job.jobType),
      levelKey: levelKeyOf(job.level ?? job.title),
      postedOn: postedOnOf(job.postedAt),
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
      whyFit: job.whyFit || job.summary || "See the posting for what the role involves.",
      gaps: job.gaps,
      companyNotes: job.companyNotes,
      companyDomain: job.companyWebsite ? companyDomain(job.companyWebsite) : null,
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
      verifiedAt: job.verifiedOpenAt && !Number.isNaN(Date.parse(job.verifiedOpenAt)) ? new Date(Date.parse(job.verifiedOpenAt)) : new Date(),
      lastCheckedAt: new Date(),
      demo: !!opts.demo,
    }).onConflictDoNothing().returning({ id: schema.jobs.id });
    if (!inserted.length) {
      // Two pushes carried the same job at once: the first one won.
      rejected.push({ url: job.url, code: "duplicate", hint: "Already sent. Only send new jobs." });
      continue;
    }
    if (pooledBefore && openSearch) {
      await db.update(schema.searches).set({ poolHits: sql`${schema.searches.poolHits} + 1` }).where(eq(schema.searches.id, openSearch.id)).catch(() => {});
    }
    remaining--;
    accepted++;
    if (job.pack) await storePack(id, job.pack);
  }

  // Packs for jobs already on the board: the person kept them, so the Mind wrote the
  // application. A pack for a kept job also queues its form questions on the You page.
  let packsAccepted = 0;
  const packsRejected: Rejection[] = [];
  if (!dryRun && parsed.data.packs?.length) {
    const board = await db.query.jobs.findMany({
      where: eq(schema.jobs.profileId, profile.id),
      columns: { id: true, url: true, company: true, status: true, formQuestions: true },
      orderBy: desc(schema.jobs.createdAt),
      limit: 400,
    });
    for (const raw of parsed.data.packs) {
      const r = packPushSchema.safeParse(raw);
      const url = typeof raw === "object" && raw && "url" in raw ? String((raw as { url: unknown }).url) : undefined;
      if (!r.success) {
        packsRejected.push({ url, code: "bad_pack", hint: r.error.issues.map((i) => `${i.path.join(".") || "pack"}: ${i.message}`).join("; ") });
        continue;
      }
      const p = r.data;
      const key = jobKey(p.url);
      const job = board.find((j) => j.url === p.url) ?? board.find((j) => jobKey(j.url) === key);
      if (!job) {
        packsRejected.push({ url: p.url, code: "unknown_job", hint: "No job with this link on the board. Packs are only for jobs you already sent and were asked for." });
        continue;
      }
      const formQuestions = p.formQuestions?.length ? p.formQuestions : (job.formQuestions ?? []);
      const note = checkPack(p.pack, formQuestions, profile);
      if (note) adjusted.push({ url: p.url, note });
      await storePack(job.id, p.pack);
      await db.update(schema.jobs).set({ formQuestions: formQuestions.length ? formQuestions : null, packRequestedAt: null }).where(eq(schema.jobs.id, job.id));
      if (job.status === "saved") await queueQuestions(profile.userId, job.company, formQuestions, p.pack.answers).catch((e) => console.error("[ingest] queue questions failed", job.id, e));
      packsAccepted++;
    }
    // Nothing left to write and no search running: the Mind goes back to sleep.
    if (!opts.demo && !isSearching(profile) && !(await jobsNeedingPacks(profile.id)).length) {
      await switchOff(profile).catch(() => {});
      await db.update(schema.profiles).set({ packRequestedAt: null }).where(eq(schema.profiles.id, profile.id));
    }
  }

  await db.insert(schema.ingestLog).values({
    profileId: profile.id,
    accepted,
    rejected: rejected.length + packsRejected.length,
    detail: [...rejected, ...packsRejected.map((r) => ({ ...r, code: `pack_${r.code}` })), ...(packsAccepted ? [{ url: "", code: "packs_written", hint: `${packsAccepted} application pack(s) written` }] : [])],
    dryRun,
  });

  // Leads it looked at and dropped, kept so the user sees why and the next search skips them.
  // Each is validated on its own: a bad one is skipped, never the whole push. A lead the Mind
  // opened before dropping for a reason about this person goes into the shared pool too.
  let droppedRecorded = 0;
  if (!dryRun && parsed.data.dropped?.length) {
    const search = openSearch;
    const seen = new Set<string>();
    const items: Dropped[] = [];
    for (const raw of parsed.data.dropped) {
      const r = droppedSchema.safeParse(raw);
      if (!r.success) continue;
      const d = r.data;
      const u = d.posting?.url ?? d.url;
      const k = (u ? jobKey(u) : `${companyKey(d.company)}|${titleKey(d.title)}`).toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      items.push(d);
    }
    const rows: (typeof schema.leads.$inferInsert)[] = [];
    for (const d of items) {
      const url = d.posting?.url ?? d.url ?? null;
      let postingRef: string | null = null;
      if (d.posting && POOLABLE_REASONS.has(d.reason)) {
        postingRef = await upsertPosting(d.posting, "dropped_lead", { demo: opts.demo }).catch((e) => (console.error("[ingest] pool", e), null));
      } else if (d.reason === "closed" && url && !opts.demo && isPublicHttpUrl(url)) {
        // Seen closed: if the pool has it, mark it so nobody opens it again.
        await db
          .update(schema.postings)
          .set({ closedAt: new Date(), lastCheckedAt: new Date() })
          .where(and(eq(schema.postings.postingKey, jobKey(url)), isNull(schema.postings.closedAt)))
          .catch(() => {});
      }
      rows.push({
        profileId: profile.id,
        searchId: search?.id ?? null,
        company: d.company,
        title: d.title,
        url,
        reason: d.reason,
        note: d.note ?? null,
        postingKey: url && !opts.demo && isPublicHttpUrl(url) ? jobKey(url) : null,
        postingRef,
      });
    }
    if (rows.length) await db.insert(schema.leads).values(rows);
    droppedRecorded = rows.length;
  }
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
  if (late) {
    searchEnded = true;
    adjusted.push({
      url: "",
      note: `You already marked this search final, so it was closed before these arrived. They were still accepted. Stop now and wait for the next SEARCH REQUEST; nothing else you send will be taken.`,
    });
    // Keep the Mind off: endSearch already switched it off, but a running turn can re-enable nothing, so just make sure.
    await switchOff(profile).catch(() => {});
  } else if (!dryRun && !opts.demo && (parsed.data.final || remaining <= 0)) {
    await endSearch(profile);
    searchEnded = true;
  }

  return { accepted, rejected, remaining, remainingToday: remaining, searchEnded, droppedRecorded, dryRun, adjusted, skippedRecently, logged: true, packsAccepted, packsRejected };
}
