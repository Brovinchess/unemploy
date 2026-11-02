import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Profile } from "@/db/schema";
import { companyKey, jobKey } from "./dedupe";
import { isPublicHttpUrl } from "./ingest";
import { countryCodeOf } from "./normalise";
import { roleWords } from "./pool";
import { allPlaces, postingAgeDays } from "./preferences";
import { eligibilityProblemFor, isAggregator } from "./quality";

// Careers pages, read by Career Ninja instead of the Mind. A job system hands out a whole board in
// one reply (Ashby's ElevenLabs board is 2 MB): a Mind that fetches it gets it as a file and pays
// about 8 cognition per read, several reads per board. Read here, the board becomes a few KB of
// plain text the Mind reads for free (replies up to 59 KB were tested free; 40 KB is the budget).
// The Mind still sees every open job; it opens only the single postings it wants to check.

export type BoardSystem = "ashby" | "greenhouse" | "lever" | "workable" | "smartrecruiters" | "workday" | "page";
type Setting = "remote" | "hybrid" | "onsite";
export type BoardJob = { title: string; location: string; setting: Setting | null; posted: string | null; url: string };
export type Board = { system: BoardSystem; company: string; total: number; jobs: BoardJob[]; text?: string; fetchedAt: number };
type Source =
  | { system: "ashby" | "greenhouse" | "lever" | "workable" | "smartrecruiters"; slug: string; eu?: boolean }
  | { system: "workday"; host: string; tenant: string; site: string }
  | { system: "page"; url: string };

const TIMEOUT_MS = 10_000;
const PAGE_BYTES = 40_000;
const CACHE_SECONDS = 3 * 3600;
const MAX_JOBS = 600; // per board; a reply never lists more
const WORKDAY_PAGE = 20; // Workday returns at most 20 per call
const WORKDAY_BROWSE = 3; // pages of unfiltered titles from a Workday board
const SYSTEM_NAME: Record<BoardSystem, string> = { ashby: "Ashby", greenhouse: "Greenhouse", lever: "Lever", workable: "Workable", smartrecruiters: "SmartRecruiters", workday: "Workday", page: "its own site" };

// Which job system a careers link belongs to, and the board's id there.
export function sourceOf(raw: string): Source | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!isPublicHttpUrl(u.toString())) return null;
  const h = u.hostname.toLowerCase();
  const seg = u.pathname.split("/").filter(Boolean);
  if (h === "jobs.ashbyhq.com" && seg[0]) return { system: "ashby", slug: seg[0] };
  if (h === "api.ashbyhq.com" && seg[0] === "posting-api" && seg[2]) return { system: "ashby", slug: seg[2] };
  if (/^(boards|job-boards)(\.eu)?\.greenhouse\.io$/.test(h)) {
    const slug = seg[0] === "embed" ? u.searchParams.get("for") : seg[0];
    if (slug) return { system: "greenhouse", slug };
  }
  if (h === "boards-api.greenhouse.io" && seg[2]) return { system: "greenhouse", slug: seg[2] };
  if ((h === "jobs.lever.co" || h === "jobs.eu.lever.co") && seg[0]) return { system: "lever", slug: seg[0], eu: h.includes(".eu.") };
  if (h === "apply.workable.com" && seg[0] && seg[0] !== "j" && seg[0] !== "api") return { system: "workable", slug: seg[0] };
  if (/^[a-z0-9-]+\.workable\.com$/.test(h) && !/^(www|apply)\./.test(h)) return { system: "workable", slug: h.split(".")[0] };
  if ((h === "jobs.smartrecruiters.com" || h === "careers.smartrecruiters.com") && seg[0]) return { system: "smartrecruiters", slug: seg[0] };
  const wd = h.match(/^([a-z0-9-]+)\.wd\d+\.myworkdayjobs\.com$/);
  if (wd) {
    const site = seg.find((s, i) => !(i === 0 && /^[a-z]{2}-[A-Z]{2}$/.test(s)) && s !== "wday" && s !== "cxs");
    if (site && site !== "job") return { system: "workday", host: h, tenant: wd[1], site };
  }
  if (isAggregator(u.toString())) return null;
  return { system: "page", url: u.toString() };
}

async function get(url: string, init?: RequestInit) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, cache: "no-store", signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; CareerNinja/1.0)", accept: "application/json, text/html", ...(init?.headers ?? {}) } });
    if (!res.ok) throw new Error(`${res.status}`);
    return res;
  } finally {
    clearTimeout(t);
  }
}
const getJson = async <T>(url: string, init?: RequestInit) => (await (await get(url, init)).json()) as T;

const day = (v: string | number | null | undefined) => {
  if (v == null || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};
// Workday says "Posted Today", "Posted Yesterday", "Posted 3 Days Ago", "Posted 30+ Days Ago".
const workdayDay = (s: string | undefined) => {
  if (!s) return null;
  const ago = /today/i.test(s) ? 0 : /yesterday/i.test(s) ? 1 : Number(s.match(/(\d+)\+?\s*day/i)?.[1] ?? NaN);
  return Number.isNaN(ago) ? null : new Date(Date.now() - ago * 86_400_000).toISOString().slice(0, 10);
};
const settingOf = (...hints: (string | boolean | null | undefined)[]): Setting | null => {
  const t = hints.filter((x) => typeof x === "string").join(" ").toLowerCase();
  if (/hybrid/.test(t)) return "hybrid";
  if (/remote/.test(t) || hints.includes(true)) return "remote";
  if (/on-?site|in office|office/.test(t)) return "onsite";
  return null;
};
const entities = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&[a-z]+;|&#\d+;/gi, " ");
const pretty = (slug: string) => slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

async function readAshby(slug: string): Promise<Omit<Board, "fetchedAt">> {
  type J = { title: string; location?: string; secondaryLocations?: { location?: string }[]; isRemote?: boolean; workplaceType?: string; publishedAt?: string; jobUrl: string; isListed?: boolean };
  const d = await getJson<{ jobs?: J[] }>(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`);
  const jobs = (d.jobs ?? []).filter((j) => j.isListed !== false).map((j) => ({
    title: clean(j.title),
    location: [j.location, ...(j.secondaryLocations ?? []).map((s) => s.location)].filter(Boolean).join("; "),
    setting: settingOf(j.workplaceType, j.isRemote ?? null),
    posted: day(j.publishedAt),
    url: j.jobUrl,
  }));
  return { system: "ashby", company: pretty(slug), total: jobs.length, jobs };
}

async function readGreenhouse(slug: string): Promise<Omit<Board, "fetchedAt">> {
  type J = { title: string; location?: { name?: string }; first_published?: string; updated_at?: string; absolute_url: string; company_name?: string };
  const d = await getJson<{ jobs?: J[] }>(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`);
  const list = d.jobs ?? [];
  const jobs = list.map((j) => ({ title: clean(j.title), location: clean(j.location?.name), setting: settingOf(j.location?.name), posted: day(j.first_published ?? j.updated_at), url: j.absolute_url }));
  return { system: "greenhouse", company: list[0]?.company_name || pretty(slug), total: jobs.length, jobs };
}

async function readLever(slug: string, eu?: boolean): Promise<Omit<Board, "fetchedAt">> {
  type J = { text: string; categories?: { location?: string; allLocations?: string[]; commitment?: string }; workplaceType?: string; createdAt?: number; hostedUrl: string };
  const d = await getJson<J[]>(`https://api${eu ? ".eu" : ""}.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`);
  const jobs = (Array.isArray(d) ? d : []).map((j) => {
    const where = j.categories?.allLocations?.length ? j.categories.allLocations.join("; ") : clean(j.categories?.location);
    return { title: clean(j.text), location: where, setting: settingOf(j.workplaceType, where), posted: day(j.createdAt), url: j.hostedUrl };
  });
  return { system: "lever", company: pretty(slug), total: jobs.length, jobs };
}

async function readWorkable(slug: string): Promise<Omit<Board, "fetchedAt">> {
  type J = { title: string; city?: string; state?: string; country?: string; telecommuting?: boolean; published_on?: string; created_at?: string; url?: string; shortlink?: string; locations?: { city?: string; country?: string }[] };
  const d = await getJson<{ name?: string; jobs?: J[] }>(`https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(slug)}`);
  const jobs = (d.jobs ?? []).map((j) => {
    const places = j.locations?.length ? j.locations.map((l) => [l.city, l.country].filter(Boolean).join(", ")) : [[j.city, j.state, j.country].filter(Boolean).join(", ")];
    return { title: clean(j.title), location: places.filter(Boolean).join("; "), setting: j.telecommuting ? ("remote" as const) : null, posted: day(j.published_on ?? j.created_at), url: j.url ?? j.shortlink ?? `https://apply.workable.com/${slug}/` };
  });
  return { system: "workable", company: d.name || pretty(slug), total: jobs.length, jobs };
}

async function readSmartRecruiters(slug: string): Promise<Omit<Board, "fetchedAt">> {
  type J = { id: string; name: string; releasedDate?: string; location?: { fullLocation?: string; city?: string; country?: string; remote?: boolean; hybrid?: boolean }; company?: { name?: string } };
  const all: J[] = [];
  let total = 0;
  for (let offset = 0; offset < MAX_JOBS; offset += 100) {
    const d = await getJson<{ totalFound?: number; content?: J[] }>(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings?limit=100&offset=${offset}`);
    total = d.totalFound ?? 0;
    all.push(...(d.content ?? []));
    if (!d.content?.length || all.length >= total) break;
  }
  const jobs = all.map((j) => ({
    title: clean(j.name),
    location: clean(j.location?.fullLocation) || [j.location?.city, j.location?.country].filter(Boolean).join(", "),
    setting: j.location?.hybrid ? ("hybrid" as const) : j.location?.remote ? ("remote" as const) : null,
    posted: day(j.releasedDate),
    url: `https://jobs.smartrecruiters.com/${slug}/${j.id}`,
  }));
  return { system: "smartrecruiters", company: all[0]?.company?.name || pretty(slug), total: Math.max(total, jobs.length), jobs };
}

// Workday boards run to hundreds of jobs and hand out 20 at a time. The person's own role words are
// searched on the board itself, so the likely matches are found; the rest is a first look of 60 titles.
async function readWorkday(host: string, tenant: string, site: string, words: string[]): Promise<Omit<Board, "fetchedAt">> {
  type J = { title: string; externalPath: string; locationsText?: string; postedOn?: string };
  type R = { total?: number; jobPostings?: J[] };
  const api = `https://${host}/wday/cxs/${tenant}/${site}/jobs`;
  const page = (searchText: string, offset: number) =>
    getJson<R>(api, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ appliedFacets: {}, limit: WORKDAY_PAGE, offset, searchText }) }).catch(() => null as R | null);
  // All calls at once: the first pages of the whole board, and two pages per role word.
  const calls = [
    ...Array.from({ length: WORKDAY_BROWSE }, (_, i) => page("", i * WORKDAY_PAGE)),
    ...words.slice(0, 4).flatMap((w) => [page(w, 0), page(w, WORKDAY_PAGE)]),
  ];
  const replies = await Promise.all(calls);
  if (!replies[0]) throw new Error("workday board did not answer");
  const seen = new Map<string, J>();
  for (const r of replies) for (const j of r?.jobPostings ?? []) seen.set(j.externalPath, j);
  // Workday reports the board's total only on a first page.
  const total = Math.max(0, ...replies.map((r) => r?.total ?? 0));
  const jobs = [...seen.values()].map((j) => ({ title: clean(j.title), location: clean(j.locationsText), setting: settingOf(j.locationsText), posted: workdayDay(j.postedOn), url: `https://${host}/${site}${j.externalPath}` }));
  return { system: "workday", company: pretty(tenant), total: Math.max(total, jobs.length), jobs };
}

// Any other careers page: its text and job-looking links, without scripts, styles or markup.
async function readPage(url: string): Promise<Omit<Board, "fetchedAt">> {
  const res = await get(url, { headers: { accept: "text/html" } });
  const html = (await res.text()).slice(0, 2_000_000);
  const links: BoardJob[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = clean(entities(m[2].replace(/<[^>]+>/g, " ")));
    let href: string;
    try {
      href = new URL(m[1], url).toString();
    } catch {
      continue;
    }
    if (text.length < 4 || text.length > 140 || !/job|career|position|opening|vacanc|role|apply/i.test(href + " " + text)) continue;
    if (!links.some((l) => l.url === href)) links.push({ title: text, location: "", setting: null, posted: null, url: href });
  }
  const text = clean(entities(html.replace(/<(script|style|noscript|svg|head)\b[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")));
  return { system: "page", company: new URL(url).hostname.replace(/^(www|careers|jobs)\./, ""), total: links.length, jobs: links.slice(0, MAX_JOBS), text: text.slice(0, PAGE_BYTES / 2) };
}

async function readSource(src: Source, words: string[]): Promise<Omit<Board, "fetchedAt">> {
  switch (src.system) {
    case "ashby":
      return readAshby(src.slug);
    case "greenhouse":
      return readGreenhouse(src.slug);
    case "lever":
      return readLever(src.slug, src.eu);
    case "workable":
      return readWorkable(src.slug);
    case "smartrecruiters":
      return readSmartRecruiters(src.slug);
    case "workday":
      return readWorkday(src.host, src.tenant, src.site, words);
    case "page":
      return readPage(src.url);
  }
}

// One read per board per three hours, whoever asks. Workday reads depend on the titles searched.
const cachedRead = unstable_cache(
  async (key: string, src: Source, words: string[]): Promise<Board> => {
    void key;
    const b = await readSource(src, words);
    return { ...b, jobs: b.jobs.filter((j) => j.title && j.url).slice(0, MAX_JOBS), fetchedAt: Date.now() };
  },
  ["careers-board-v1"],
  { revalidate: CACHE_SECONDS },
);

export async function readBoard(src: Source, words: string[]) {
  const key = src.system === "page" ? `page:${src.url}` : src.system === "workday" ? `workday:${src.host}/${src.site}:${words.slice(0, 4).join(",")}` : `${src.system}:${src.slug.toLowerCase()}${"eu" in src && src.eu ? ":eu" : ""}`;
  return cachedRead(key, src, src.system === "workday" ? words : []);
}

// The jobs that could suit this person: a role word in the title, a place they can work from,
// and fresh enough. The same tests the check-first list uses.
export function splitBoard(board: Board, profile: Pick<Profile, "preferences">) {
  const prefs = profile.preferences;
  if (!prefs) return { fits: [] as BoardJob[], rest: board.jobs };
  const words = roleWords(prefs);
  const places = allPlaces(prefs);
  const codes = [...new Set(places.map((p) => countryCodeOf(p.country)).filter(Boolean))];
  const oldest = new Date(Date.now() - postingAgeDays(prefs) * 86_400_000).toISOString().slice(0, 10);
  const remoteOk = prefs.workSettings.includes("remote") || prefs.workSettings.includes("hybrid");
  const fitsPlace = (j: BoardJob) => {
    if (!j.location) return true; // unknown: let the Mind judge from the posting
    const code = countryCodeOf(j.location);
    if (code && codes.includes(code)) return true;
    if (!remoteOk) return false;
    return eligibilityProblemFor(j.location, places) === null;
  };
  const fits: BoardJob[] = [];
  const rest: BoardJob[] = [];
  for (const j of board.jobs) {
    const title = j.title.toLowerCase();
    const titleOk = !words.length || words.some((w) => title.includes(w));
    const fresh = !j.posted || j.posted >= oldest;
    (titleOk && fresh && fitsPlace(j) ? fits : rest).push(j);
  }
  return { fits, rest };
}

// The reply, in pages of at most PAGE_BYTES: the fitting jobs in full, then every other title.
export function boardText(board: Board, fits: BoardJob[], rest: BoardJob[], page = 1) {
  const head = `Career Ninja read ${board.company}'s careers page (${SYSTEM_NAME[board.system]}): ${board.total} open ${board.total === 1 ? "job" : "jobs"}. Open only the single job links you want to check, and confirm each one there as usual. Do not open this careers page or its job board yourself.`;
  const full = (j: BoardJob) => [j.title, j.location || "place not listed", j.setting ?? "", j.posted ?? "", j.url].join(" | ");
  const short = (j: BoardJob) => `${j.title}${j.location ? ` (${j.location})` : ""} ${j.url}`;
  const lines = [
    fits.length ? `JOBS THAT MAY FIT ME (${fits.length}): title | place | setting | posted | link` : "No job on this board matched my roles and places at a glance; check the other titles below.",
    ...fits.map(full),
    rest.length ? `OTHER OPEN JOBS (${rest.length}${board.total > board.jobs.length ? `, plus ${board.total - board.jobs.length} more not listed` : ""}). Open one only if its title fits my roles after all:` : "",
    ...rest.map(short),
    board.system === "page" && board.text ? `PAGE TEXT (first part):\n${board.text}` : "",
  ].filter(Boolean);
  const pages: string[][] = [[]];
  let size = head.length;
  for (const l of lines) {
    if (size + l.length + 1 > PAGE_BYTES && pages[pages.length - 1].length) {
      pages.push([]);
      size = head.length;
    }
    pages[pages.length - 1].push(l);
    size += l.length + 1;
  }
  const n = Math.min(Math.max(1, page), pages.length);
  const more = n < pages.length ? `Page ${n} of ${pages.length}. For the next page, add &page=${n + 1} to the same link.` : pages.length > 1 ? `Page ${n} of ${pages.length}, the last.` : "";
  return [head, more, ...pages[n - 1]].filter(Boolean).join("\n");
}

// Every job on a board just read is open today: it goes into the shared postings, so other
// people's headhunters can find it in their check-first list. Facts only; a row someone's
// headhunter sent with full facts keeps them, and only learns it was seen open again.
export async function saveBoardPostings(board: Board) {
  if (board.system === "page") return 0;
  const now = new Date();
  const rows = board.jobs
    .filter((j) => isPublicHttpUrl(j.url))
    .map((j) => ({
      postingKey: jobKey(j.url),
      url: j.url,
      title: j.title.slice(0, 300),
      company: board.company,
      companyKey: companyKey(board.company),
      countryCode: countryCodeOf(j.location),
      workSetting: j.setting,
      postedOn: j.posted,
      locationText: j.location || null,
      source: "board_read" as const,
      demo: false,
      firstSeenAt: now,
      lastSeenAt: now,
      lastVerifiedOpenAt: now,
      closedAt: null,
    }));
  const unique = [...new Map(rows.map((r) => [r.postingKey, r])).values()];
  for (let i = 0; i < unique.length; i += 100) {
    await db
      .insert(schema.postings)
      .values(unique.slice(i, i + 100))
      .onConflictDoUpdate({ target: schema.postings.postingKey, set: { lastSeenAt: now, lastVerifiedOpenAt: now, closedAt: sql`null` } });
  }
  return unique.length;
}
