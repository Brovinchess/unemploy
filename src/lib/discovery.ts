// What to type and where: wider title variations so one role name doesn't miss jobs, and a
// search strategy that works anywhere: plain web searches for the titles plus the place,
// straight to employers' own job pages, with the region's job sites found by the Mind itself
// (looked up once, remembered) and used only to discover leads.

// Title variations people use for the same work, so one role name doesn't miss jobs.
const VARIANTS: [RegExp, string[]][] = [
  [/product (manager|owner|lead)/i, ["Product Manager", "Senior Product Manager", "Product Owner", "Product Lead", "Technical Product Manager", "AI Product Manager", "Growth Product Manager", "Platform Product Manager", "Head of Product", "Group Product Manager"]],
  [/product designer|ux designer|ui designer/i, ["Product Designer", "UX Designer", "UI/UX Designer", "Senior Product Designer", "Interaction Designer", "Design Lead"]],
  [/software engineer|developer|frontend|backend|full ?stack/i, ["Software Engineer", "Senior Software Engineer", "Frontend Engineer", "Backend Engineer", "Full-stack Engineer", "Web Developer"]],
  [/data (analyst|scientist)|analytics/i, ["Data Analyst", "Data Scientist", "Product Analyst", "Analytics Engineer", "Business Intelligence Analyst"]],
  [/marketing/i, ["Marketing Manager", "Growth Marketing Manager", "Digital Marketing Manager", "Performance Marketing Manager", "Marketing Lead"]],
  [/sales|account executive|business development/i, ["Account Executive", "Sales Manager", "Business Development Manager", "Sales Development Representative", "Account Manager"]],
  [/project manager|program manager|delivery/i, ["Project Manager", "Program Manager", "Delivery Manager", "Technical Program Manager", "Scrum Master"]],
];

// The region a country belongs to, for the ladder's region rung.
const REGIONS: [RegExp, string][] = [
  [/malaysia|singapore|indonesia|thailand|vietnam|philippines|cambodia|myanmar|brunei|laos/i, "Southeast Asia, then the wider APAC region"],
  [/hong kong|taiwan|china|macau/i, "Greater China, then the wider APAC region"],
  [/japan|korea/i, "East Asia, then the wider APAC region"],
  [/australia|new zealand/i, "Australia and New Zealand, then the wider APAC region"],
  [/india|pakistan|bangladesh|sri lanka|nepal/i, "South Asia, then the wider APAC region"],
  [/united arab emirates|saudi|qatar|bahrain|kuwait|oman|egypt|jordan|israel/i, "the Middle East"],
  [/united kingdom|ireland|germany|france|netherlands|spain|italy|portugal|sweden|denmark|norway|finland|poland|switzerland|austria|belgium/i, "Europe"],
  [/united states|canada|mexico/i, "North America"],
  [/brazil|argentina|chile|colombia|peru/i, "Latin America"],
  [/south africa|nigeria|kenya|ghana/i, "Africa"],
];
export const regionFor = (country: string) => REGIONS.find(([re]) => re.test(country))?.[1] ?? "its region";

export function discoveryHints(targetRoles: string) {
  const titles = new Set(targetRoles.split(/,|\/| or /i).map((r) => r.trim()).filter(Boolean));
  for (const [re, list] of VARIANTS) if (re.test(targetRoles)) list.forEach((t) => titles.add(t));
  return { titles: [...titles].slice(0, 14) };
}

const SYSTEMS = ["jobs.lever.co", "boards.greenhouse.io", "jobs.ashbyhq.com", "apply.workable.com", "myworkdayjobs.com", "jobs.smartrecruiters.com"];

// The ladder: where to look, one rung at a time, nearest first. Each rung is a short list of
// searches that land on employers' own job pages. The brief prints only the rungs the person's
// settings allow (region needs remote or hybrid on; global needs remote scope "anywhere").
export type Rung = { n: number; name: string; minutes: number; lines: string[] };

export function ladder(prefs: { targetRoles: string; country: string; city: string; workSettings: string[]; remoteScope: string }): Rung[] {
  const { titles } = discoveryHints(prefs.targetRoles);
  const main = titles.slice(0, 3);
  const wider = titles.slice(3, 10);
  const q = (t: string[]) => t.map((x) => `"${x}"`).join(" OR ");
  const city = prefs.city?.trim();
  const region = regionFor(prefs.country);
  const remoteOk = prefs.workSettings.includes("remote") || prefs.workSettings.includes("hybrid");
  const rungs: Rung[] = [
    { n: 0, name: "Postings to check first", minutes: 5, lines: [`GET the "check first" link in the search request: postings seen open recently that may fit me. Confirm each is still open and fits; send the ones that pass. Then go to rung 1.`] },
  ];
  if (city) {
    rungs.push({
      n: 1, name: `${city}`, minutes: 20,
      lines: [
        `One job-system search: ${SYSTEMS.slice(0, 3).map((h) => `site:${h}`).join(" OR ")} "${city}" ${q(main)}.`,
        `Your employer list: companies in ${city} that hire ${main[0] ?? "my role"}s. Keep it in memory, reuse it, add to it each search; open each one's careers page directly.`,
        `One web search: ${q(main)} ${city} careers.`,
      ],
    });
  }
  rungs.push({
    n: 2, name: `The rest of ${prefs.country}`, minutes: 20,
    lines: [
      `One job-system search: ${SYSTEMS.slice(0, 3).map((h) => `site:${h}`).join(" OR ")} "${prefs.country}" ${q(main)}.`,
      `One web search: ${q(main)} ${prefs.country} careers${remoteOk ? `, plus one for ${q(main)} remote ${prefs.country}` : ""}.`,
    ],
  });
  rungs.push({
    n: 3, name: "Wider titles, same places", minutes: 15,
    lines: [
      `One or two of the rung ${city ? "1 and 2" : "2"} searches again with the wider title family: ${wider.length ? wider.slice(0, 5).join("; ") : "the same titles one level up or down"}.`,
    ],
  });
  if (remoteOk && prefs.remoteScope !== "country") {
    rungs.push({
      n: 4, name: `Remote in ${region}`, minutes: 20,
      lines: [
        `One job-system search: ${SYSTEMS.slice(0, 3).map((h) => `site:${h}`).join(" OR ")} "remote" ${q(main)} ${region.split(",")[0]}.`,
        `One web search: ${q(main)} remote ${region.split(",")[0]} "apply".`,
        `Only postings whose location line names ${prefs.country}, the region, or anywhere; "remote" alone is not enough.`,
      ],
    });
  }
  if (remoteOk && prefs.remoteScope === "anywhere") {
    rungs.push({
      n: 5, name: "Remote from anywhere", minutes: 20,
      lines: [
        `One job-system search: ${SYSTEMS.slice(0, 3).map((h) => `site:${h}`).join(" OR ")} "remote" "worldwide" ${q(main)}.`,
        `One web search: ${q(main)} remote worldwide "apply".`,
        `Only postings open to applicants from ${prefs.country}: worldwide, anywhere, or a list that includes ${prefs.country}. "US remote", "EU only" and the like are not for me.`,
      ],
    });
  }
  return rungs;
}

export function ladderText(prefs: Parameters<typeof ladder>[0]) {
  const rungs = ladder(prefs);
  const place = [prefs.city, prefs.country].filter(Boolean).join(", ");
  return [
    `Go rung by rung, nearest first. Stay on a rung until its time box is up or you have opened 8 postings in a row from it without sending a job, then move to the next. Never skip ahead because the first results look thin. Send each job as soon as it passes; nearer jobs reach me first that way. The BUDGET below caps the whole search.`,
    ...rungs.map((r) => `Rung ${r.n}: ${r.name} (${r.minutes} min)\n${r.lines.map((l) => `   ${l}`).join("\n")}`),
    `Nothing past the last rung. Jobs in other countries, or remote jobs not open to ${place}, are never worth opening.`,
    `Job sites (LinkedIn, Indeed, JobStreet and the like) only to find leads, never as the link you send. Many block automated reading: if one will not open, move on; do not retry.`,
  ].join("\n");
}
