import type { Pace } from "@/lib/coach";
import { paceLine } from "@/lib/coach-ui";

// On the headhunter page, above the preferences: how the last search went. Tips sit beside the rows they are about.
export function Coach({ pace }: { pace: Pace | null }) {
  if (!pace) return null;
  return (
    <div className="mb-6 rounded-2xl bg-night-2 p-4">
      <p className="text-sm text-white/70">
        {paceLine(pace)}
        {pace.arrivals.length > 1 && <span className="text-white/40"> Arrived at {pace.arrivals.map((m) => `${m} min`).join(", ")}.</span>}
      </p>
    </div>
  );
}
