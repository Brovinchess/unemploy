import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { detailsComplete, extensionUser, isSupported, MIN_EXTENSION_VERSION } from "@/lib/extension";

// A light "who am I and is there anything to do": polled by the popup and by every app page,
// so it carries counts only, never packs or files.
export async function GET(request: Request) {
  const user = await extensionUser(request);
  if (!user) return NextResponse.json({ error: "not_connected" }, { status: 401 });
  const profiles = await db.query.profiles.findMany({ where: eq(schema.profiles.userId, user.id), columns: { id: true } });
  const ids = profiles.map((p) => p.id);
  // Kept jobs whose application pack is written; the ones still being written don't count yet.
  const urls = ids.length
    ? await db
        .select({ url: schema.jobs.url })
        .from(schema.jobs)
        .innerJoin(schema.packs, eq(schema.packs.jobId, schema.jobs.id))
        .where(and(inArray(schema.jobs.profileId, ids), eq(schema.jobs.status, "saved")))
    : [];
  return NextResponse.json(
    {
      user: user.username,
      detailsComplete: detailsComplete(user.applicant),
      waiting: urls.length,
      supported: urls.filter((j) => isSupported(j.url)).length,
      minVersion: MIN_EXTENSION_VERSION,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
