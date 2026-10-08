import "server-only";
import type { Profile } from "@/db/schema";
import { coachSuggestions, searchPace, TARGET_MIN_PER_JOB } from "./coach";

export function paceLine(p: { jobs: number; minutes: number; perJob: number | null }) {
  const dur = p.minutes >= 60 ? `${Math.floor(p.minutes / 60)} h ${p.minutes % 60} min` : `${p.minutes} min`;
  return p.jobs
    ? `Last search: ${p.jobs} ${p.jobs === 1 ? "job" : "jobs"} in ${dur}, about ${p.perJob} minutes per job. The target is ${TARGET_MIN_PER_JOB}.`
    : `Last search: nothing found in ${dur}.`;
}

// What the search button shows before the next search, when the last one was slow.
export async function coachFor(profile: Profile) {
  const pace = await searchPace(profile.id);
  if (!pace || !pace.tooSlow) return null;
  const suggestions = await coachSuggestions(profile, pace);
  if (!suggestions.length) return null;
  return { summary: paceLine(pace), suggestions, modifyHref: `/app/headhunters/${profile.id}#looks-for` };
}
