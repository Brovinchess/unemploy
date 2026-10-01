import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { extensionUser } from "@/lib/extension";

// The extension saw the company's "application received" page.
export async function POST(request: Request) {
  const user = await extensionUser(request);
  if (!user) return NextResponse.json({ error: "not_connected" }, { status: 401 });
  const { jobId } = (await request.json().catch(() => ({}))) as { jobId?: string };
  if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) return NextResponse.json({ error: "bad_job" }, { status: 400 });

  const profiles = await db.query.profiles.findMany({ where: eq(schema.profiles.userId, user.id), columns: { id: true } });
  const updated = await db
    .update(schema.jobs)
    .set({ status: "applied", statusChangedAt: new Date() })
    .where(and(eq(schema.jobs.id, jobId), inArray(schema.jobs.profileId, profiles.map((p) => p.id))))
    .returning({ id: schema.jobs.id });
  return NextResponse.json({ ok: updated.length === 1 });
}
