import { NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { applyUrl, detailsComplete, extensionUser, isSupported } from "@/lib/extension";

// What "Apply to all" works through: the user's To-apply jobs with their packs, the
// resumes they need, and the details to type into forms.
export async function GET(request: Request) {
  const user = await extensionUser(request);
  if (!user) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  const profiles = await db.query.profiles.findMany({ where: eq(schema.profiles.userId, user.id) });
  const ids = profiles.map((p) => p.id);
  const jobs = ids.length
    ? await db.query.jobs.findMany({
        where: and(inArray(schema.jobs.profileId, ids), eq(schema.jobs.status, "saved")),
        orderBy: desc(schema.jobs.matchScore),
      })
    : [];
  const packs = jobs.length ? await db.query.packs.findMany({ where: inArray(schema.packs.jobId, jobs.map((j) => j.id)) }) : [];
  const packFor = new Map(packs.map((p) => [p.jobId, p]));

  return NextResponse.json(
    {
      user: user.username,
      applicant: user.applicant ?? null,
      detailsComplete: detailsComplete(user.applicant),
      resumes: Object.fromEntries(
        profiles
          .filter((p) => p.resumeData && jobs.some((j) => j.profileId === p.id))
          .map((p) => [p.id, { fileName: p.resumeFileName, mime: p.resumeMime, data: p.resumeData }]),
      ),
      jobs: jobs.map((j) => {
        const pack = packFor.get(j.id);
        return {
          id: j.id,
          title: j.title,
          company: j.company,
          domain: j.companyDomain,
          url: j.url,
          applyUrl: applyUrl(j.url),
          supported: isSupported(j.url),
          resume: j.profileId,
          coverLetter: pack?.coverLetter ?? "",
          aboutMe: pack?.aboutMe ?? "",
          answers: pack?.answers ?? [],
        };
      }),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
