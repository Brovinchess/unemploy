// Clean, filterable values beside the free text a Mind sends. Pure functions with no
// server-only imports.

// Order matters where names overlap: the UK (with Northern Ireland and Perth, Scotland) comes
// before Ireland and Australia, and the explicit US forms (including New Mexico) before Mexico.
const COUNTRIES: [RegExp, string][] = [
  [/\b(australia|new south wales|nsw|sydney|melbourne|brisbane|adelaide|perth, (australia|wa))\b/i, "AU"],
  [/\b(united kingdom|u\.?k\.?|great britain|england|scotland|wales|northern ireland|belfast|london|manchester|edinburgh|glasgow)\b/i, "GB"],
  [/\b(united states|u\.?s\.?a\.?|us[- ](only|based|remote|citizens?)|new mexico|new york|san francisco|los angeles|seattle|austin|boston|chicago|denver|miami)\b/i, "US"],
  [/\b(malaysia|malaysian|kuala lumpur|kl|penang|johor|selangor)\b/i, "MY"],
  [/\b(singapore|singaporean)\b/i, "SG"],
  [/\b(hong kong|hk\b)\b/i, "HK"],
  [/\b(indonesia|jakarta|bali)\b/i, "ID"],
  [/\b(thailand|bangkok)\b/i, "TH"],
  [/\b(philippines|manila|cebu|filipino)\b/i, "PH"],
  [/\b(vietnam|hanoi|ho chi minh|saigon)\b/i, "VN"],
  [/\b(taiwan|taipei)\b/i, "TW"],
  [/\b(japan|tokyo|osaka)\b/i, "JP"],
  [/\b(south korea|korea|seoul)\b/i, "KR"],
  [/\b(china|shanghai|beijing|shenzhen)\b/i, "CN"],
  [/\b(india|bangalore|bengaluru|mumbai|delhi|hyderabad|pune|chennai)\b/i, "IN"],
  [/\b(pakistan|karachi|lahore)\b/i, "PK"],
  [/\b(bangladesh|dhaka)\b/i, "BD"],
  [/\b(sri lanka|colombo)\b/i, "LK"],
  [/\b(new zealand|auckland|wellington)\b/i, "NZ"],
  [/\b(united arab emirates|uae|dubai|abu dhabi)\b/i, "AE"],
  [/\b(saudi arabia|riyadh|jeddah)\b/i, "SA"],
  [/\b(qatar|doha)\b/i, "QA"],
  [/\b(israel|tel aviv)\b/i, "IL"],
  [/\b(turkey|t[uü]rkiye|istanbul|ankara|izmir|mugla|muğla|antalya)\b/i, "TR"],
  [/\b(belarus|minsk)\b/i, "BY"],
  [/\b(egypt|cairo)\b/i, "EG"],
  [/\b(nigeria|lagos)\b/i, "NG"],
  [/\b(kenya|nairobi)\b/i, "KE"],
  [/\b(south africa|cape town|johannesburg)\b/i, "ZA"],
  [/\b(ireland|dublin)\b/i, "IE"],
  [/\b(the netherlands|netherlands|holland|amsterdam|rotterdam|dutch)\b/i, "NL"],
  [/\b(germany|berlin|munich|hamburg|frankfurt)\b/i, "DE"],
  [/\b(france|paris|lyon)\b/i, "FR"],
  [/\b(spain|madrid|barcelona)\b/i, "ES"],
  [/\b(portugal|lisbon|porto)\b/i, "PT"],
  [/\b(italy|milan|rome)\b/i, "IT"],
  [/\b(belgium|brussels)\b/i, "BE"],
  [/\b(switzerland|zurich|geneva)\b/i, "CH"],
  [/\b(austria|vienna)\b/i, "AT"],
  [/\b(poland|warsaw|krakow)\b/i, "PL"],
  [/\b(czech|czechia|prague)\b/i, "CZ"],
  [/\b(romania|bucharest)\b/i, "RO"],
  [/\b(sweden|stockholm)\b/i, "SE"],
  [/\b(denmark|copenhagen)\b/i, "DK"],
  [/\b(norway|oslo)\b/i, "NO"],
  [/\b(finland|helsinki)\b/i, "FI"],
  [/\b(ukraine|kyiv)\b/i, "UA"],
  [/\b(greece|athens)\b/i, "GR"],
  [/\b(hungary|budapest)\b/i, "HU"],
  [/\b(canada|toronto|vancouver|montreal)\b/i, "CA"],
  [/\b(mexico|mexico city)\b/i, "MX"],
  [/\b(brazil|brasil|são paulo|sao paulo)\b/i, "BR"],
  [/\b(argentina|buenos aires)\b/i, "AR"],
  [/\b(chile|santiago)\b/i, "CL"],
  [/\b(colombia|bogot[aá])\b/i, "CO"],
  [/\b(peru|lima)\b/i, "PE"],
  [/\b(uruguay|montevideo)\b/i, "UY"],
];

// ISO-2 country for a posting, from its stated country first, then its location line.
// Display names for the codes above (admin charts group free-text countries by these).
export const COUNTRY_NAMES: Record<string, string> = {
  AU: "Australia", GB: "United Kingdom", US: "United States", MY: "Malaysia", SG: "Singapore", HK: "Hong Kong", ID: "Indonesia", TH: "Thailand", PH: "Philippines", VN: "Vietnam",
  TW: "Taiwan", JP: "Japan", KR: "South Korea", CN: "China", IN: "India", PK: "Pakistan", BD: "Bangladesh", LK: "Sri Lanka", NZ: "New Zealand", AE: "United Arab Emirates",
  SA: "Saudi Arabia", QA: "Qatar", IL: "Israel", EG: "Egypt", NG: "Nigeria", KE: "Kenya", ZA: "South Africa", IE: "Ireland", NL: "Netherlands", DE: "Germany", FR: "France",
  ES: "Spain", PT: "Portugal", IT: "Italy", BE: "Belgium", CH: "Switzerland", AT: "Austria", PL: "Poland", CZ: "Czechia", RO: "Romania", SE: "Sweden", DK: "Denmark", NO: "Norway",
  FI: "Finland", UA: "Ukraine", GR: "Greece", HU: "Hungary", CA: "Canada", MX: "Mexico", BR: "Brazil", AR: "Argentina", CL: "Chile", CO: "Colombia", PE: "Peru", UY: "Uruguay",
  TR: "Turkey", BY: "Belarus",
};

// Words people use for a country that aren't its display name, removed when the rest is a city.
const COUNTRY_WORDS = /\b(united kingdom|u\.?k\.?|great britain|england|united states|u\.?s\.?a?\.?|the netherlands|t[uü]rkiye|uae|hong kong sar)\b/gi;

// "London" → London, United Kingdom. "new york" → New York, United States. "rayong thailand"
// → Rayong, Thailand. "Malaysia" → just the country. Used wherever a person types where they live,
// so the country is always a real country name and the city, if any, is separate.
export function parsePlace(input: string, cityInput = ""): { country: string; city: string } {
  const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])([a-z\u00C0-\u024F])/g, (m, p, c) => p + c.toUpperCase());
  const clean = (s: string) => s.replace(/[\s,;.:()-]+$/g, "").replace(/^[\s,;.:()-]+/g, "").replace(/\s+/g, " ").trim();
  const raw = clean(input);
  const code = countryCodeOf(raw);
  if (!code || !COUNTRY_NAMES[code]) return { country: raw, city: clean(cityInput) };
  const country = COUNTRY_NAMES[code];
  // What's left once the country (by any name) is taken out is the city, if it's short.
  let rest = clean(raw.replace(new RegExp(country, "ig"), "").replace(COUNTRY_WORDS, "").replace(/^\s*the\b/i, ""));
  if (rest && /[-,;:]/.test(rest)) rest = clean(rest.split(/[-,;:]/)[0]);
  const city = cityInput.trim() ? clean(cityInput) : rest && rest.split(" ").length <= 3 && rest.toLowerCase() !== country.toLowerCase() ? titleCase(rest) : "";
  return { country, city };
}

export function countryCodeOf(...texts: (string | null | undefined)[]): string | null {
  for (const t of texts) {
    if (!t) continue;
    for (const [re, code] of COUNTRIES) if (re.test(t)) return code;
  }
  return null;
}

export type JobTypeKey = "full_time" | "part_time" | "contract" | "temporary" | "internship" | "freelance";
export function jobTypeKeyOf(text?: string | null): JobTypeKey | null {
  const s = (text ?? "").toLowerCase();
  if (!s) return null;
  if (/\bintern(ship)?s?\b/.test(s)) return "internship";
  if (/freelanc|self[- ]?employed/.test(s)) return "freelance";
  if (/contract|fixed[- ]term|contractor/.test(s)) return "contract";
  if (/\btemp(orary)?\b/.test(s)) return "temporary";
  if (/part[- ]?time/.test(s)) return "part_time";
  if (/full[- ]?time|permanent|regular/.test(s)) return "full_time";
  return null;
}

export type LevelKey = "intern" | "junior" | "mid" | "senior" | "lead" | "director" | "exec";
export function levelKeyOf(text?: string | null): LevelKey | null {
  const s = (text ?? "").toLowerCase();
  if (!s) return null;
  if (/\bintern(ship)?s?\b/.test(s)) return "intern";
  // "Account executive" and "executive assistant" are not the C-suite.
  if (/\b(chief|cxo|ceo|cto|coo|cfo|cpo|president|vp|vice president|executive director|c-level)\b/.test(s)) return "exec";
  if (/\b(director|head of)\b/.test(s)) return "director";
  if (/\b(lead|principal|staff)\b/.test(s)) return "lead";
  if (/\b(senior|sr\.?|mid[- ]senior)\b/.test(s)) return "senior";
  if (/\b(junior|jr\.?|entry|graduate|associate)\b/.test(s)) return "junior";
  if (/\bmid\b/.test(s)) return "mid";
  return null;
}

// A real calendar date (YYYY-MM-DD) from whatever the Mind wrote, or null when it isn't one.
export function postedOnOf(text?: string | null): string | null {
  if (!text) return null;
  const t = Date.parse(text);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  if (d.getFullYear() < 2015 || d.getTime() > Date.now() + 86_400_000) return null;
  // Date-only strings parse as UTC and others as local time; read the parts the same way they were parsed.
  const utc = /^\d{4}-\d{2}-\d{2}$/.test(text.trim());
  const y = utc ? d.getUTCFullYear() : d.getFullYear();
  const m = (utc ? d.getUTCMonth() : d.getMonth()) + 1;
  const day = utc ? d.getUTCDate() : d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// The person's name from a resume: a "Name:" label if there is one, otherwise the first line that
// looks like a name (2 to 4 capitalised words, no instructions, no contact details). Null when unsure.
const NOT_A_NAME =
  /\b(please|email|e-mail|photo|resume|cv|curriculum|vitae|form|address|phone|mobile|summary|profile|objective|experience|education|skills|work|travel|usa|application|yourself|contact|linkedin|portfolio|date|birth|manager|engineer|designer|developer|analyst|director|lead|specialist|consultant|marketing|product|senior|junior|head|officer|associate|executive|assistant|intern|student|graduate|university|college|school|permanent|home|street|road|jalan|city|state|country|postcode|zip|nationality|gender|age)\b/i;
// Lowercase particles that sit inside real names.
const PARTICLE = /^(de|van|der|den|von|da|di|del|della|le|la|du|bin|binti|binte|ibn|al|el|ter|te|dos|das|e|y)$/;
const nameWord = (w: string) => /^[A-Z][a-zA-Z'-]*\.?$/.test(w) || /^[A-Z]{2,}$/.test(w) || PARTICLE.test(w);

export function guessName(resumeText: string | null | undefined): string | null {
  const text = (resumeText ?? "").replace(/\r/g, "");
  // "Name: Chang Kangyan", "Name Chang Kangyan", or the name on the next line. PDF text often
  // runs lines together ("Name Chang Kangyan Permanent Home Address"), so take words only while
  // they still look like a name.
  const labelled = text.match(/(?:^|\n)[ \t]*(?:[Ff]ull[ \t]+)?[Nn]ame[ \t]*[:\-]?[ \t]*\n?[ \t]*((?:[A-Za-z'-]+[ \t]*){1,6})/);
  if (labelled) {
    const words: string[] = [];
    for (const w of labelled[1].trim().split(/[ \t]+/)) {
      if (words.length >= 4 || !nameWord(w) || NOT_A_NAME.test(w)) break;
      words.push(w);
    }
    while (words.length && PARTICLE.test(words[words.length - 1])) words.pop();
    if (words.length >= 2 && !PARTICLE.test(words[0])) return words.join(" ");
  }
  const lines = text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 30);
  for (const l of lines) {
    if (l.length > 40 || /[@\d|•·/]/.test(l) || NOT_A_NAME.test(l)) continue;
    const words = l.split(" ");
    if (words.length < 2 || words.length > 4) continue;
    if (words.every(nameWord) && nameWord(words[0]) && !PARTICLE.test(words[0])) return l;
  }
  return null;
}

// ---- Details from the resume --------------------------------------------------------------

// What a resume usually states about the person, for prefilling "Your details". Heuristics
// only: the person checks and saves. Anything unsure is left blank rather than guessed.
export type GuessedDetails = Partial<{
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  website: string;
  currentTitle: string;
  currentCompany: string;
}>;

const TITLE_WORD =
  /\b(manager|engineer|designer|developer|analyst|lead|head|director|officer|specialist|consultant|product|marketing|sales|intern|associate|executive|architect|scientist|founder|co-founder|ceo|cto|coo|cfo|vp|president|coordinator|administrator|accountant|teacher|nurse|researcher|strategist|writer|editor|recruiter|owner|partner|principal|advisor|adviser|assistant|technician|supervisor|planner|buyer|controller)\b/i;
const SECTION = /^(summary|profile|objective|experience|work experience|employment|education|skills|projects|certifications?|languages|interests|references|about( me)?|contact)$/i;

function cleanLines(text: string) {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

// The text of a line with the date span removed, e.g. "Senior PM, Acme (2022 – present)" → "Senior PM, Acme".
const DATE_SPAN = /[\(\[]?(?:\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?\b\d{4}\s*[–—-]\s*(?:present|current|now|today|ongoing)\b[\)\]]?|[\(\[]?\b(?:present|current)\b[\)\]]?/i;

function splitRole(line: string): { title?: string; company?: string } {
  const rest = line
    .replace(DATE_SPAN, "")
    .replace(/.*(?:→|->|⇒)\s*/, "") // "Product Manager → Product Owner": the current one is the last
    .replace(/\s*[|·•,–—-]+\s*$/, "")
    .replace(/^\s*[|·•,–—-]+\s*/, "")
    .trim();
  const at = rest.match(/^(.*?)\s+(?:at|@)\s+(.*)$/i);
  const parts = at ? [at[1], at[2]] : rest.split(/\s*(?:\||·|•|,|–|—| - )\s*/).filter(Boolean);
  if (parts.length < 2) {
    if (parts.length === 1 && TITLE_WORD.test(parts[0])) return { title: parts[0] };
    if (parts.length === 1) return { company: parts[0] };
    return {};
  }
  // A place in the line ("Grab, Kuala Lumpur") is neither the title nor the company.
  const [a, b] = parts.filter((x) => !(countryCodeOf(x) && !TITLE_WORD.test(x)));
  if (!a) return {};
  if (!b) return TITLE_WORD.test(a) ? { title: a } : { company: a };
  const aTitle = TITLE_WORD.test(a);
  const bTitle = TITLE_WORD.test(b);
  if (aTitle && !bTitle) return { title: a, company: b };
  if (bTitle && !aTitle) return { title: b, company: a };
  if (!aTitle && !bTitle) return { company: a };
  return { title: a, company: b };
}

export function guessDetails(resumeText: string | null | undefined): GuessedDetails {
  const text = (resumeText ?? "").replace(/\r/g, "");
  if (!text.trim()) return {};
  const out: GuessedDetails = {};
  const lines = cleanLines(text);
  const top = lines.slice(0, 15).join("\n");

  const name = guessName(text);
  if (name) {
    // ALL CAPS names come back as Title Case; mixed case is kept as written.
    const cased = /^[A-Z\s'-]+$/.test(name) ? name.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (m, p, c) => p + c.toUpperCase()) : name;
    const [first, ...rest] = cased.split(/\s+/);
    out.firstName = first;
    if (rest.length) out.lastName = rest.join(" ");
  }

  const email = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if (email) out.email = email[0];

  // A phone: at least 8 digits, allowing +, spaces, dashes, dots and brackets; never a year range.
  const phoneLine = lines.find((l) => /\b(phone|mobile|tel|cell|whatsapp)\b/i.test(l)) ?? "";
  const phoneIn = (s: string) => {
    for (const m of s.matchAll(/\+?\(?\d[\d\s().-]{6,}\d/g)) {
      const digits = m[0].replace(/\D/g, "");
      if (digits.length >= 8 && digits.length <= 15 && !/\d{4}\s*[–—-]\s*\d{4}/.test(m[0])) return m[0].trim();
    }
    return null;
  };
  const phone = phoneIn(phoneLine) ?? phoneIn(top);
  if (phone) out.phone = phone;

  const li = text.match(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_%-]+\/?/i);
  if (li) out.linkedin = (li[0].startsWith("http") ? "" : "https://") + li[0].replace(/\/$/, "");
  const site = [...text.matchAll(/(?:https?:\/\/|www\.)[^\s|•·,)]+|(?<![@\w.])\b[a-z0-9-]+\.(?:com|io|me|dev|design|co|net|org|my|sg|ai|app|xyz|site|studio|work)(?:\/[^\s|•·,)]*)?/gi)]
    .map((m) => m[0].replace(/[.;:]+$/, ""))
    .find((u) => !/linkedin\.com|github\.com\/?$|mailto:|@/.test(u) && !(out.email && out.email.endsWith(u.replace(/^https?:\/\/|^www\./g, ""))));
  if (site) out.website = site.startsWith("http") ? site : `https://${site}`;

  // Where they live: a labelled line, or the first top segment that names a place.
  const labelled = top.match(/(?:^|\n)[ \t]*(?:location|address|based in|lives in|city)[ \t]*[:\-][ \t]*([^\n|•·]+)/i);
  if (labelled) {
    // Keep the city and country, not the street: drop parts with digits, keep the last three.
    const bits = labelled[1].trim().replace(/[.,;]+$/, "").split(/\s*,\s*/).filter((b) => b && !/\d/.test(b));
    const v = bits.slice(-3).join(", ");
    if (v && v.length <= 80 && countryCodeOf(v)) out.location = v;
  }
  if (!out.location) {
    outer: for (const l of lines.slice(0, 15)) {
      const segs = l.split(/\s*(?:\||·|•|;|\s{2,}|\s[–—]\s)\s*/).map((x) => x.trim()).filter(Boolean);
      for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        if (/@|https?:|www\.|\d{5,}/.test(seg) || seg.length > 60 || !countryCodeOf(seg)) continue;
        // Keep "City, Country" or "City, State, Country"; drop a title glued in front ("Designer, KL").
        const bits = seg.split(/\s*,\s*/).filter((b) => !TITLE_WORD.test(b));
        if (bits.length && bits.join(", ").length <= 60) {
          out.location = bits.slice(-3).join(", ");
          break outer;
        }
      }
    }
  }

  // Current role: the experience line whose dates run to the present.
  const idx = lines.findIndex((l, i) => i > 0 && /\b(present|current)\b/i.test(l) && /\d{4}|present/i.test(l) && !/^(summary|profile|objective)/i.test(l) && l.length <= 140);
  if (idx > 0) {
    let role = splitRole(lines[idx]);
    // Two-line entries: "Senior PM" above "Acme | 2022 – present", or the other way round.
    if (!role.title || !role.company) {
      const prev = lines[idx - 1];
      if (prev && prev.length <= 80 && !SECTION.test(prev) && !/\d{4}/.test(prev)) {
        const r2 = splitRole(prev);
        role = { title: role.title ?? r2.title ?? (TITLE_WORD.test(prev) ? prev : undefined), company: role.company ?? r2.company ?? (!TITLE_WORD.test(prev) ? prev : undefined) };
      }
    }
    if (!role.company) {
      // "Product Owner 2024 – Present" with the employer on the next line.
      const next = lines[idx + 1];
      if (next && next.length <= 80 && !SECTION.test(next) && !/\d{4}|^[-•·*]/.test(next) && !TITLE_WORD.test(next) && !/\b(led|built|owned|managed|shipped|designed|drove|grew)\b/i.test(next)) {
        role.company = next.replace(/\s*\([^)]*\)/g, "").split(/\s*(?:\||·|•|–|—| - )\s*/)[0];
      }
    }
    if (role.title && role.title.length <= 80 && TITLE_WORD.test(role.title)) out.currentTitle = role.title.replace(/[.,;:]+$/, "");
    if (role.company && role.company.length <= 80 && !SECTION.test(role.company)) out.currentCompany = role.company.replace(/[.,;:]+$/, "");
  }
  if (!out.currentTitle) {
    // The headline under the name, e.g. "Product Designer · Kuala Lumpur".
    const head = lines.slice(1, 4).map((l) => l.split(/\s*(?:\||·|•|,|;|\s[–—]\s)\s*/)[0].trim()).find((x) => x.length <= 60 && TITLE_WORD.test(x) && !/\d/.test(x));
    if (head) out.currentTitle = head;
  }
  return out;
}
