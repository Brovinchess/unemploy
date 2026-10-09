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

export function discoveryHints(targetRoles: string) {
  const titles = new Set(targetRoles.split(/,|\/| or /i).map((r) => r.trim()).filter(Boolean));
  for (const [re, list] of VARIANTS) if (re.test(targetRoles)) list.forEach((t) => titles.add(t));
  return { titles: [...titles].slice(0, 14) };
}

export function discoveryText(targetRoles: string, country: string, city = "") {
  const { titles } = discoveryHints(targetRoles);
  const place = [city, country].filter(Boolean).join(", ");
  return (
    `SEARCH WIDELY. Titles to search for (all of them, not just one): ${titles.join("; ")}. ` +
    `Main method: plain web searches that combine a title with the place or "remote" (e.g. "Senior Product Manager" ${place} careers; "Product Owner" remote APAC "apply"), which land on employers' own job pages. ` +
    `Also search the job systems directly: site:jobs.lever.co, site:boards.greenhouse.io, site:jobs.ashbyhq.com, site:apply.workable.com, site:myworkdayjobs.com, site:jobs.smartrecruiters.com, each with "${country}", "remote" or the region. ` +
    `Job sites: don't assume which ones matter. The first time you search for me, look up which job sites and boards people in ${country} and its region actually use, save that list in your memory, and reuse it. Use them only to find leads; many block automated reading, so if one won't open, move on rather than retry. ` +
    `Whatever the source, trace each lead to the employer's own careers page or job system and send THAT link; job-site links are refused.`
  );
}
