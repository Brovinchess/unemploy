// Where to look first and what to type: the region's popular job sites (for finding jobs,
// never as the link we accept) and wider title variations, so a search casts a broad net
// while every job is still verified on the employer's own page.

const BOARDS: Record<string, string[]> = {
  malaysia: ["JobStreet", "LinkedIn Jobs", "Hiredly", "Indeed Malaysia", "Glints"],
  singapore: ["MyCareersFuture", "LinkedIn Jobs", "JobStreet", "Glints"],
  indonesia: ["Glints", "LinkedIn Jobs", "JobStreet", "Kalibrr"],
  philippines: ["JobStreet", "LinkedIn Jobs", "Kalibrr", "Indeed"],
  thailand: ["JobsDB", "LinkedIn Jobs", "JobThai"],
  vietnam: ["TopCV", "VietnamWorks", "LinkedIn Jobs", "ITviec"],
  "hong kong": ["JobsDB", "LinkedIn Jobs", "CTgoodjobs"],
  india: ["Naukri", "LinkedIn Jobs", "Indeed India", "Instahyre"],
  australia: ["Seek", "LinkedIn Jobs", "Indeed Australia"],
  "united kingdom": ["LinkedIn Jobs", "Indeed UK", "Reed", "Otta"],
  "united states": ["LinkedIn Jobs", "Indeed", "Wellfound", "Built In"],
  "united arab emirates": ["LinkedIn Jobs", "Bayt", "GulfTalent"],
};
const DEFAULT_BOARDS = ["LinkedIn Jobs", "Indeed", "Glassdoor"];

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

export function discoveryHints(targetRoles: string, country: string) {
  const boards = BOARDS[country.trim().toLowerCase()] ?? DEFAULT_BOARDS;
  const titles = new Set(targetRoles.split(/,|\/| or /i).map((r) => r.trim()).filter(Boolean));
  for (const [re, list] of VARIANTS) if (re.test(targetRoles)) list.forEach((t) => titles.add(t));
  return { boards, titles: [...titles].slice(0, 14) };
}

export function discoveryText(targetRoles: string, country: string) {
  const { boards, titles } = discoveryHints(targetRoles, country);
  return (
    `SEARCH WIDELY. Titles to search for (all of them, not just one): ${titles.join("; ")}. ` +
    `Also try the ATS sites directly (site:jobs.lever.co, site:boards.greenhouse.io, site:jobs.ashbyhq.com, site:apply.workable.com with "${country}", "remote" or "APAC"). ` +
    `Use the job sites people in ${country} use to FIND leads: ${boards.join(", ")}. Then trace each lead to the employer's own careers page or job system and send THAT link; job-site links are still refused.`
  );
}
