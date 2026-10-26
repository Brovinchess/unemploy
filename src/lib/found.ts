import "server-only";
import { and, desc, eq, ne, notLike } from "drizzle-orm";
import { db, schema } from "@/db";

// What headhunters have found, for the landing page and the app sidebar: a lightly masked owner,
// title, company and place. No times. Every job still open, in a fresh random order per request.
export type Find = { title: string; company: string; domain: string | null; place: string; owner: string };

// "rovin" becomes "R***N": first and last letter, stars for the rest, never the whole name.
export function maskName(name: string) {
  const n = name.replace(/[^a-z0-9]/gi, "");
  if (n.length <= 2) return `${n[0]?.toUpperCase() ?? "A"}*`;
  return `${n[0].toUpperCase()}${"*".repeat(Math.min(5, n.length - 2))}${n[n.length - 1].toUpperCase()}`;
}

export async function recentFinds(limit = 80): Promise<Find[]> {
  const rows = await db
    .select({ title: schema.jobs.title, company: schema.jobs.company, companyDomain: schema.jobs.companyDomain, city: schema.jobs.city, country: schema.jobs.country, workSetting: schema.jobs.workSetting, username: schema.users.username })
    .from(schema.jobs)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.jobs.profileId))
    .innerJoin(schema.users, eq(schema.users.id, schema.profiles.userId))
    .where(
      and(
        eq(schema.jobs.demo, false),
        ne(schema.jobs.status, "expired"),
        notLike(schema.jobs.url, "%example.com%"),
        notLike(schema.jobs.url, "%retired.example%"),
      ),
    )
    .orderBy(desc(schema.jobs.createdAt))
    .limit(limit * 3);
  const seen = new Set<string>();
  const out: Find[] = [];
  for (const j of rows) {
    const key = `${j.company.toLowerCase()}|${j.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const place = [j.city, j.country].filter(Boolean).join(", ") || (j.workSetting === "remote" ? "Remote" : "");
    out.push({ title: j.title, company: j.company, domain: j.companyDomain ?? null, place, owner: maskName(j.username ?? "someone") });
    if (out.length >= limit) break;
  }
  return shuffle(out);
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
