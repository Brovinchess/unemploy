import "server-only";

// Checks that keep job quality high no matter how well a Mind follows its brief. From
// auditing the first real deliveries: aggregator copies outlive the real posting, "remote"
// often means one country, and closed postings still answer 200.

// Sites that copy postings from elsewhere. The employer's own page (or its job system)
// is the only reliable source for whether a job is open and who it hires.
const AGGREGATORS = [
  "remoteok.com", "remoteok.io", "bebee.com", "startup.jobs", "jobgether.com", "jooble.org", "adzuna.com",
  "talent.com", "careerjet.com", "simplyhired.com", "ziprecruiter.com", "himalayas.app", "jobicy.com",
  "remotive.com", "remote.co", "workingnomads.com", "builtin.com", "glassdoor.com", "jobrapido.com",
  "whatjobs.com", "jobsora.com", "trabajo.org", "neuvoo.com", "echojobs.io", "hiring.cafe",
];

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isAggregator(url: string) {
  const h = hostOf(url);
  return AGGREGATORS.some((a) => h === a || h.endsWith(`.${a}`));
}

// ---------- Eligibility for remote jobs ----------

const OPEN_TO_ALL =
  /\b(anywhere|worldwide|world-wide|globally|global remote|fully distributed|any country|almost any country|all countries|all time ?zones|international(ly)?|apac|asia[- ]pacific|asia|south[- ]?east asia|sea region)\b/i;

const PLACES =
  /\b(u\.?s\.?a?|united states|us[- ](only|based|remote)|canada|north america|americas|latam|latin america|south america|u\.?k\.?|united kingdom|england|ireland|europe|european union|e\.?u\.?|emea|cet|poland|germany|france|spain|portugal|netherlands|belgium|italy|romania|ukraine|sweden|denmark|norway|finland|switzerland|austria|czech|uruguay|argentina|colombia|mexico|brazil|chile|india|australia|new zealand|singapore|philippines|indonesia|vietnam|thailand|japan|korea|china|hong kong|taiwan|israel|uae|dubai|saudi|egypt|nigeria|kenya|south africa)\b/i;

// Returns a problem when the posting's own location line rules the user out, or doesn't
// say enough to know. `null` means eligible.
export function eligibilityProblem(locationText: string, userCountry: string, userCity?: string): string | null {
  const text = locationText.toLowerCase();
  const mentionsUser = [userCountry, userCity].filter(Boolean).some((p) => text.includes(p!.toLowerCase()));
  if (mentionsUser || OPEN_TO_ALL.test(text)) return null;
  const place = text.match(PLACES)?.[0];
  if (place) return `The posting limits hiring to places that don't include ${userCountry} ("${place}").`;
  return `The location line doesn't say who can apply. Open the posting and quote the line that shows ${userCountry} (or anywhere/worldwide/APAC) is allowed. If it doesn't say, skip the job.`;
}

// ---------- Is the posting still open? ----------

const CLOSED_PHRASES = [
  "no longer accepting applications",
  "no longer accepting application",
  "this job is no longer available",
  "this job has expired",
  "job has been closed",
  "position has been filled",
  "this position is no longer",
  "posting has closed",
  "job posting is closed",
  "no longer open",
  "job not found",
  "the job you are looking for",
  "page you are looking for doesn",
  "tidak lagi menerima permohonan",
];

export type Liveness = "open" | "closed" | "unknown";

// Follows redirects by hand (each hop must pass `isSafe`) and reads the start of the page.
// Network errors and bot walls are "unknown", never "closed".
// Greenhouse boards block plain page fetches but publish a public job API.
function greenhouseApi(url: string) {
  const m = url.match(/^https:\/\/(?:job-boards(?:\.eu)?|boards(?:\.eu)?)\.greenhouse\.io\/([\w-]+)\/jobs\/(\d+)/);
  return m ? `https://boards-api.greenhouse.io/v1/boards/${m[1]}/jobs/${m[2]}` : null;
}

// A hard ceiling on top of the per-request timeouts: a slow or stalled page must never hold
// up an ingest or the daily recheck.
export function checkPosting(url: string, isSafe: (u: string) => boolean, ms = 12_000): Promise<Liveness> {
  return Promise.race([checkPostingInner(url, isSafe), new Promise<Liveness>((r) => setTimeout(() => r("unknown"), ms))]);
}

async function checkPostingInner(url: string, isSafe: (u: string) => boolean): Promise<Liveness> {
  const gh = greenhouseApi(url);
  if (gh) {
    try {
      const res = await fetch(gh, { signal: AbortSignal.timeout(8000), cache: "no-store" });
      if (res.status === 404) return "closed";
      if (res.ok) return "open";
    } catch {
      // fall through to the page check
    }
  }
  let current = url;
  try {
    for (let hop = 0; hop < 5; hop++) {
      if (!isSafe(current)) return "unknown";
      const res = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CareerNinjaLinkCheck/1.0)", Accept: "text/html" },
      });
      if (res.status === 404 || res.status === 410) return "closed";
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get("location");
        if (!next) return "unknown";
        const resolved = new URL(next, current).toString();
        // Greenhouse and others bounce closed jobs to the board with an error flag.
        if (/[?&]error=true\b/.test(resolved)) return "closed";
        current = resolved;
        continue;
      }
      if (!res.ok) return "unknown";
      const reader = res.body?.getReader();
      if (!reader) return "open";
      let html = "";
      while (html.length < 400_000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += new TextDecoder().decode(value);
      }
      reader.cancel().catch(() => {});
      const lower = html.toLowerCase();
      return CLOSED_PHRASES.some((p) => lower.includes(p)) ? "closed" : "open";
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}
