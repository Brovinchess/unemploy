import { NextResponse } from "next/server";
import { desc, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";

// Temporary, owner only: every dropped lead and every refused push in the last N days, as text.
export async function GET(request: Request) {
  const me = await getCurrentUser();
  if (me?.username !== "rovinc") return NextResponse.json({ error: "not found" }, { status: 404 });
  const days = Math.min(30, Number(new URL(request.url).searchParams.get("days") ?? 3) || 3);
  const since = new Date(Date.now() - days * 86_400_000);
  const profiles = await db.query.profiles.findMany({ columns: { id: true, label: true, userId: true } });
  const users = await db.query.users.findMany({ columns: { id: true, username: true } });
  const who = new Map(profiles.map((p) => [p.id, `${users.find((u) => u.id === p.userId)?.username ?? "?"}/${p.label}`]));
  const leads = await db.query.leads.findMany({ where: gte(schema.leads.createdAt, since), orderBy: desc(schema.leads.createdAt) });
  const logs = await db.query.ingestLog.findMany({ where: gte(schema.ingestLog.createdAt, since), orderBy: desc(schema.ingestLog.createdAt) });
  const jobs = await db.query.jobs.findMany({ where: gte(schema.jobs.createdAt, since), columns: { profileId: true, company: true, title: true, createdAt: true, matchScore: true } });
  const t = (d: Date) => d.toISOString().slice(5, 16).replace("T", " ");
  const out: string[] = [`LEADS DROPPED BY THE MIND (${leads.length}) since ${since.toISOString().slice(0, 10)}`, "time | user/headhunter | reason | company | title | note | url"];
  for (const l of leads) out.push([t(l.createdAt), who.get(l.profileId), l.reason, l.company, l.title, (l.note ?? "").replace(/\s+/g, " "), l.url ?? ""].join(" | "));
  out.push("", `PUSHES REFUSED OR ADJUSTED BY THE APP`, "time | user/headhunter | accepted | rejected | detail");
  for (const g of logs) {
    const d = g.detail as { url?: string; code?: string; hint?: string }[] | null;
    if (!d?.length) continue;
    out.push([t(g.createdAt), who.get(g.profileId), g.accepted, g.rejected, d.map((x) => `${x.code ?? "adjusted"}: ${x.url ?? ""} ${(x.hint ?? "").slice(0, 160)}`).join(" || ")].join(" | "));
  }
  out.push("", `JOBS DELIVERED (${jobs.length})`, "time | user/headhunter | match | company | title");
  for (const j of jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) out.push([t(j.createdAt), who.get(j.profileId), Math.round(j.matchScore), j.company, j.title].join(" | "));
  return new NextResponse(out.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
