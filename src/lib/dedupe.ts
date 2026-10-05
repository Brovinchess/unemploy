// Recognises the same job when it comes back under a different link or wording, so a
// headhunter can't show the user a posting twice.

// Query parameters that only say where a click came from.
const TRACKING = /^(utm_.*|ref|referrer|source|src|gh_src|lever-source.*|lever-origin|ashby_.*|trk|trackingid|refid|fbclid|gclid|mc_.*|_hs.*|campaign|medium|via|t)$/i;

// One key per posting. Job systems are keyed by their own ids, whatever their address;
// anything else is its host and path without tracking, "/apply" or a trailing slash.
export function jobKey(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return raw.trim().toLowerCase();
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const parts = u.pathname.split("/").filter(Boolean).map((p) => decodeURIComponent(p).toLowerCase());

  // Greenhouse: boards / job-boards(.eu).greenhouse.io/<board>/jobs/<id>, or ?gh_jid=<id> on a careers page.
  const gh = u.searchParams.get("gh_jid");
  if (host.endsWith("greenhouse.io")) {
    const i = parts.indexOf("jobs");
    if (i > 0 && parts[i + 1]) return `greenhouse:${parts[i - 1]}/${parts[i + 1]}`;
    if (gh) return `greenhouse:${parts[0] ?? ""}/${gh}`;
  }
  if (gh) return `greenhouse:${host}/${gh}`;

  // Lever: jobs(.eu).lever.co/<company>/<id>[/apply]
  if (host.endsWith("lever.co") && parts.length >= 2) return `lever:${parts[0]}/${parts[1]}`;
  // Ashby: jobs.ashbyhq.com/<company>/<id>[/application]
  if (host.endsWith("ashbyhq.com") && parts.length >= 2) return `ashby:${parts[0]}/${parts[1]}`;
  // Workable: apply.workable.com/<company>/j/<id>[/apply]
  if (host.endsWith("workable.com")) {
    const j = parts.indexOf("j");
    if (j >= 0 && parts[j + 1]) return `workable:${parts[0]}/${parts[j + 1]}`;
  }

  const path = parts.filter((p, i) => !(i === parts.length - 1 && /^(apply|application)$/.test(p))).join("/");
  const query = [...u.searchParams.entries()]
    .filter(([k]) => !TRACKING.test(k))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k.toLowerCase()}=${v}`)
    .join("&");
  return `${host}/${path}${query ? `?${query}` : ""}`;
}

const SUFFIXES = /\b(inc|llc|ltd|limited|corp|corporation|co|gmbh|pte|sdn bhd|bhd|plc|ag|sa|bv)\b\.?/g;
export const companyKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9& ]+/g, " ").replace(SUFFIXES, " ").replace(/\s+/g, " ").trim();
// Titles compared on their words, ignoring punctuation and bracketed notes like "(Remote)".
export const titleKey = (s: string) => s.toLowerCase().replace(/\(.*?\)|\[.*?\]/g, " ").replace(/[^a-z0-9+#]+/g, " ").replace(/\s+/g, " ").trim();

export type SeenJob = { url: string; company: string; title: string; createdAt: Date };

// Within this window, the same company and title counts as the same job even on another link.
export const SAME_ROLE_DAYS = 60;

export class SeenJobs {
  private urls = new Set<string>();
  private roles = new Map<string, Date>();
  constructor(jobs: SeenJob[]) {
    for (const j of jobs) this.add(j);
  }
  add(j: SeenJob) {
    this.urls.add(jobKey(j.url));
    const role = `${companyKey(j.company)}|${titleKey(j.title)}`;
    const prev = this.roles.get(role);
    if (!prev || prev < j.createdAt) this.roles.set(role, j.createdAt);
  }
  // "link" when the posting itself was seen, "role" when the same role at the same company
  // was sent recently under another link, otherwise null.
  match(j: { url: string; company: string; title: string }, now = Date.now()): "link" | "role" | null {
    if (this.urls.has(jobKey(j.url))) return "link";
    const at = this.roles.get(`${companyKey(j.company)}|${titleKey(j.title)}`);
    if (at && now - at.getTime() < SAME_ROLE_DAYS * 86_400_000) return "role";
    return null;
  }
}
