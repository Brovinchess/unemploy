import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { extensionUser } from "@/lib/extension";

// One resume file, fetched when a job's form asks for it.
export async function GET(request: Request) {
  const user = await extensionUser(request);
  if (!user) return NextResponse.json({ error: "not_connected" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("profile") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "bad_profile" }, { status: 400 });
  const p = await db.query.profiles.findFirst({
    where: and(eq(schema.profiles.id, id), eq(schema.profiles.userId, user.id)),
    columns: { resumeFileName: true, resumeMime: true, resumeData: true },
  });
  if (!p?.resumeData) return NextResponse.json({ error: "no_resume" }, { status: 404 });
  return NextResponse.json({ fileName: p.resumeFileName, mime: p.resumeMime, data: p.resumeData }, { headers: { "Cache-Control": "no-store" } });
}
