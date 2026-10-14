import { NextResponse } from "next/server";
import { eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { jobKey } from "@/lib/dedupe";
import { isPublicHttpUrl, upsertPosting } from "@/lib/ingest";
import { countryCodeOf, jobTypeKeyOf, levelKeyOf, postedOnOf } from "@/lib/normalise";
import { requireUser } from "@/lib/session";

// One-off: fills the clean columns for existing jobs and leads and seeds the shared pool
// from every job already found. Owner only. Remove once run.
export async function GET() {
  const me = await requireUser();
  if (me.username !== "rovinc") return NextResponse.json({ error: "no" }, { status: 403 });

  const jobs = await db.query.jobs.findMany({ where: eq(schema.jobs.demo, false) });
  let pooled = 0;
  for (const j of jobs) {
    const key = await upsertPosting(
      {
        url: j.url,
        title: j.title,
        company: j.company,
        city: j.city ?? undefined,
        country: j.country ?? undefined,
        workSetting: j.workSetting,
        jobType: j.jobType ?? undefined,
        level: j.level ?? undefined,
        salary: j.salary ?? undefined,
        salaryEstimated: j.salaryEstimated,
        postedAt: j.postedAt ?? undefined,
        locationText: j.locationText ?? "See posting",
        summary: j.summary ?? undefined,
        mustHaves: (j.mustHaves ?? []).map((m) => m.requirement),
        companyWebsite: j.companyDomain ?? undefined,
        companyStage: j.companyStage ?? undefined,
        companySize: j.companySize ?? undefined,
        industry: j.industry ?? undefined,
        perks: j.perks ?? undefined,
      },
      "accepted",
      { verifiedOpenAt: (j.lastCheckedAt ?? j.verifiedAt ?? j.createdAt).toISOString() },
    ).catch((e) => (console.error("[backfill] pool", j.id, e), null));
    if (key) {
      pooled++;
      // Keep the pool's first-seen honest and mark postings we already know are closed.
      await db
        .update(schema.postings)
        .set({ firstSeenAt: j.createdAt, ...(j.status === "expired" ? { closedAt: j.statusChangedAt ?? new Date() } : {}) })
        .where(eq(schema.postings.postingKey, key));
    }
    await db
      .update(schema.jobs)
      .set({
        postingKey: key,
        countryCode: countryCodeOf(j.country, j.locationText),
        jobTypeKey: jobTypeKeyOf(j.jobType),
        levelKey: levelKeyOf(j.level ?? j.title),
        postedOn: postedOnOf(j.postedAt),
      })
      .where(eq(schema.jobs.id, j.id));
  }

  const leads = await db.query.leads.findMany({ where: isNotNull(schema.leads.url), columns: { id: true, url: true } });
  let keyed = 0;
  for (const l of leads) {
    if (!l.url || !isPublicHttpUrl(l.url)) continue;
    await db.update(schema.leads).set({ postingKey: jobKey(l.url) }).where(eq(schema.leads.id, l.id));
    keyed++;
  }

  return NextResponse.json({ ok: true, jobs: jobs.length, pooled, leadsKeyed: keyed });
}
