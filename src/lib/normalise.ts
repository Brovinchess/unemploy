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
