import "server-only";
import { and, desc, eq, gte, ne, notLike } from "drizzle-orm";
import { db, schema } from "@/db";

// What headhunters found lately, for the landing page: title, company and place only. No names,
// no times, nothing that points back at a person. One line per company and title.
export type Find = { title: string; company: string; domain: string | null; place: string };
const DAYS = 14;

export async function recentFinds(limit = 40): Promise<Find[]> {
  const rows = await db.query.jobs.findMany({
    where: and(
      eq(schema.jobs.demo, false),
      ne(schema.jobs.status, "expired"),
      gte(schema.jobs.createdAt, new Date(Date.now() - DAYS * 86_400_000)),
      notLike(schema.jobs.url, "%example.com%"),
      notLike(schema.jobs.url, "%retired.example%"),
    ),
    orderBy: desc(schema.jobs.createdAt),
    columns: { title: true, company: true, companyDomain: true, city: true, country: true, workSetting: true },
    limit: limit * 3,
  });
  const seen = new Set<string>();
  const out: Find[] = [];
  for (const j of rows) {
    const key = `${j.company.toLowerCase()}|${j.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const place = [j.city, j.country].filter(Boolean).join(", ") || (j.workSetting === "remote" ? "Remote" : "");
    out.push({ title: j.title, company: j.company, domain: j.companyDomain ?? null, place });
    if (out.length >= limit) break;
  }
  return out;
}
