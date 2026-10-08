import "server-only";
import type { Profile } from "@/db/schema";
import { coachSuggestions, searchPace } from "./coach";

export function paceLine(p: { jobs: number; minutes: number; perJob: number | null }) {
  const dur = p.minutes >= 60 ? `${Math.floor(p.minutes / 60)} h ${p.minutes % 60} min` : `${p.minutes} min`;
  return p.jobs ? `Last time: ${p.jobs} ${p.jobs === 1 ? "job" : "jobs"} in ${dur}. A small change could speed things up.` : `Last time: ${dur} and nothing found. Let's change something.`;
}

// What the search button shows before the next search, when the last one was slow.
export async function coachFor(profile: Profile) {
  const pace = await searchPace(profile.id);
  if (!pace || !pace.tooSlow) return null;
  const suggestions = await coachSuggestions(profile, pace);
  if (!suggestions.length) return null;
  return { summary: paceLine(pace), empty: pace.jobs === 0, suggestions, modifyHref: `/app/headhunters/${profile.id}#looks-for` };
}
