// Clean, filterable values beside the free text a Mind sends. Pure functions: used at ingest
// and by one-off backfills, so no server-only imports here.

const COUNTRIES: [RegExp, string][] = [
  [/\b(malaysia|malaysian|kuala lumpur|\bkl\b|penang|johor|selangor)\b/i, "MY"],
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
  [/\b(australia|sydney|melbourne|brisbane|perth)\b/i, "AU"],
  [/\b(new zealand|auckland|wellington)\b/i, "NZ"],
  [/\b(united arab emirates|uae|dubai|abu dhabi)\b/i, "AE"],
  [/\b(saudi arabia|riyadh|jeddah)\b/i, "SA"],
  [/\b(qatar|doha)\b/i, "QA"],
  [/\b(israel|tel aviv)\b/i, "IL"],
  [/\b(egypt|cairo)\b/i, "EG"],
  [/\b(nigeria|lagos)\b/i, "NG"],
  [/\b(kenya|nairobi)\b/i, "KE"],
  [/\b(south africa|cape town|johannesburg)\b/i, "ZA"],
  [/\b(united kingdom|u\.?k\.?|great britain|england|scotland|wales|london|manchester)\b/i, "GB"],
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
  [/\b(czech|prague)\b/i, "CZ"],
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
  // "US" last: a bare "us" matches too easily, so only the explicit forms count.
  [/\b(united states|u\.?s\.?a\.?|us[- ](only|based|remote|citizens?)|new york|san francisco|los angeles|seattle|austin|boston|chicago|denver|miami)\b/i, "US"],
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
  if (/intern/.test(s)) return "internship";
  if (/freelanc|self[- ]?employed/.test(s)) return "freelance";
  if (/contract|fixed[- ]term|contractor/.test(s)) return "contract";
  if (/temp/.test(s)) return "temporary";
  if (/part[- ]?time/.test(s)) return "part_time";
  if (/full[- ]?time|permanent|regular/.test(s)) return "full_time";
  return null;
}

export type LevelKey = "intern" | "junior" | "mid" | "senior" | "lead" | "director" | "exec";
export function levelKeyOf(text?: string | null): LevelKey | null {
  const s = (text ?? "").toLowerCase();
  if (!s) return null;
  if (/intern/.test(s)) return "intern";
  if (/\b(chief|cxo|ceo|cto|coo|cfo|cpo|executive|president|vp|vice president)\b/.test(s)) return "exec";
  if (/\b(director|head of)\b/.test(s)) return "director";
  if (/\b(lead|principal|staff|manager)\b/.test(s)) return "lead";
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
  return d.toISOString().slice(0, 10);
}
