import "server-only";
import type { FormQuestion } from "@/db/schema";

// Reads an application form's questions from the job system itself, so the headhunter is handed
// the list instead of opening the form as a document (which costs the person about 8 cognition a
// page, and more when it runs code to parse it). Greenhouse publishes the questions as JSON; Lever
// embeds them in the apply page. Ashby and everything else return null and the Mind reads the
// form itself, as before. Name, contact, resume and cover letter fields are left out: the
// extension fills those from the person's details.

const TIMEOUT_MS = 8000;
const SKIP = /^(first|last|full|preferred)?\s*name$|^e-?mail|^phone|^resume|^cv\b|resume\/cv|^cover letter|^location \(city\)$|^linkedin|^github|^portfolio|^other website|^website|^current (company|location)$|^pronouns?$/i;

// Questions about protected characteristics are never stored or answered (see the privacy policy).
const EEO = /gender|race|ethnicit|veteran|military|disabilit|sexual orientation|religion|date of birth|age\b/i;

export function skipsQuestion(label: string) {
  return SKIP.test(label.trim()) || EEO.test(label);
}

async function get(url: string, init?: RequestInit) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; CareerNinja/1.0)", accept: "application/json, text/html", ...(init?.headers ?? {}) } });
  } finally {
    clearTimeout(t);
  }
}

const clean = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/[✱*]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Greenhouse: boards-api.greenhouse.io/v1/boards/{board}/jobs/{id}?questions=true
function greenhouseApi(url: string) {
  const m = url.match(/^https:\/\/(?:job-boards(?:\.eu)?|boards(?:\.eu)?)\.greenhouse\.io\/([\w-]+)\/jobs\/(\d+)/);
  if (m) return `https://boards-api.greenhouse.io/v1/boards/${m[1]}/jobs/${m[2]}?questions=true`;
  const q = url.match(/[?&]gh_jid=(\d+)/);
  const board = url.match(/greenhouse\.io\/([\w-]+)/)?.[1];
  return q && board ? `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${q[1]}?questions=true` : null;
}

type GhQuestion = { label?: string; required?: boolean; fields?: { type?: string; values?: { label?: string }[] }[] };

async function greenhouse(url: string): Promise<FormQuestion[] | null> {
  const api = greenhouseApi(url);
  if (!api) return null;
  const r = await get(api);
  if (!r.ok) return null;
  const d = (await r.json()) as { questions?: GhQuestion[] };
  const out: FormQuestion[] = [];
  for (const q of d.questions ?? []) {
    const label = clean(q.label ?? "");
    if (!label || skipsQuestion(label)) continue;
    const f = q.fields?.[0];
    if (f?.type === "input_file") continue;
    const options = (f?.values ?? []).map((v) => clean(v.label ?? "")).filter(Boolean);
    out.push({ question: label.slice(0, 300), ...(options.length ? { options: options.slice(0, 30) } : {}), ...(q.required ? { required: true } : {}) });
  }
  return out;
}

// Lever: the apply page carries the standard fields as labelled blocks and the custom questions
// as JSON in hidden "cards[...][baseTemplate]" inputs.
async function lever(url: string): Promise<FormQuestion[] | null> {
  const m = url.match(/^https:\/\/jobs(?:\.eu)?\.lever\.co\/([\w.-]+)\/([\w-]+)/);
  if (!m) return null;
  const r = await get(`https://jobs${url.includes(".eu.lever.co") ? ".eu" : ""}.lever.co/${m[1]}/${m[2]}/apply`);
  if (!r.ok) return null;
  const html = await r.text();
  const out: FormQuestion[] = [];
  const seen = new Set<string>();
  const push = (q: FormQuestion) => {
    const k = q.question.toLowerCase();
    if (!q.question || seen.has(k) || skipsQuestion(q.question)) return;
    seen.add(k);
    out.push(q);
  };
  for (const b of html.matchAll(/<li class="(application-question[^"]*)">([\s\S]*?)<\/li>/g)) {
    const block = b[2];
    if (b[1].includes("custom-question")) continue; // these come from the JSON below, with options
    const lab = block.match(/application-label[^>]*>([\s\S]*?)<\/div>/);
    if (!lab) continue;
    const label = clean(lab[1]);
    const options = [...block.matchAll(/<option[^>]*>([\s\S]*?)<\/option>/g)].map((o) => clean(o[1])).filter((o) => o && !/^select/i.test(o));
    push({ question: label.slice(0, 300), ...(options.length ? { options: options.slice(0, 30) } : {}), ...(/required/.test(block) ? { required: true } : {}) });
  }
  for (const c of html.matchAll(/name="cards\[[\w-]+\]\[baseTemplate\]"[^>]*value="([^"]*)"|value="([^"]*)"[^>]*name="cards\[[\w-]+\]\[baseTemplate\]"/g)) {
    try {
      const json = JSON.parse(clean(c[1] ?? c[2] ?? "").replace(/\s+/g, " ")) as { fields?: { text?: string; required?: boolean; options?: { text?: string }[] }[] };
      for (const f of json.fields ?? []) {
        const label = clean(f.text ?? "");
        const options = (f.options ?? []).map((o) => clean(o.text ?? "")).filter(Boolean);
        push({ question: label.slice(0, 300), ...(options.length ? { options: options.slice(0, 30) } : {}), ...(f.required ? { required: true } : {}) });
      }
    } catch {}
  }
  return out;
}

// The questions for a job's application form, or null when this job system can't be read here.
export async function fetchFormQuestions(url: string): Promise<FormQuestion[] | null> {
  try {
    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      return null;
    }
    if (host.endsWith("greenhouse.io")) return await greenhouse(url);
    if (host.endsWith("lever.co")) return await lever(url);
    return null;
  } catch (e) {
    console.error("[forms] read failed", url, e);
    return null;
  }
}
