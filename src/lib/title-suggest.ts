import "server-only";
import data from "@/data/job-titles.json";

// Job-title suggestions as the person types, from the O*NET list plus a curated tier (see
// src/data/JOB-TITLES-LICENSE.md). Whole-title prefix first, then a word starting with what was
// typed, then every typed word matching a word start; common titles before the long tail; short
// before long. All in memory: about 46,000 titles.

type Entry = { title: string; lower: string; words: string[]; core: boolean };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#&/ -]+/g, " ").replace(/\s+/g, " ").trim();
const entries: Entry[] = [
  ...(data.core as string[]).map((title) => ({ title, lower: norm(title), words: norm(title).split(" "), core: true })),
  ...(data.more as string[]).map((title) => ({ title, lower: norm(title), words: norm(title).split(" "), core: false })),
];

export function suggestTitles(query: string, limit = 8): string[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const qWords = q.split(" ");
  const scored: { e: Entry; score: number }[] = [];
  for (const e of entries) {
    let score = 0;
    if (e.lower.startsWith(q)) score = 40;
    else if (e.words.some((w) => w.startsWith(q))) score = 30;
    else if (qWords.every((qw) => e.words.some((w) => w.startsWith(qw)))) score = 20;
    else if (qWords.length === 1 && e.lower.includes(q)) score = 10;
    if (!score) continue;
    if (e.core) score += 5;
    score -= Math.min(4, e.words.length - 1); // shorter titles read as the plain form
    scored.push({ e, score });
  }
  scored.sort((a, b) => b.score - a.score || a.e.title.length - b.e.title.length || a.e.title.localeCompare(b.e.title));
  return scored.slice(0, limit).map((s) => s.e.title);
}
