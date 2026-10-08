import { Lightbulb } from "lucide-react";
import type { Pace, Suggestion } from "@/lib/coach";
import { paceLine } from "@/lib/coach-ui";

// On the headhunter page, above the preferences: how the last search went and what to change.
export function Coach({ pace, suggestions }: { pace: Pace | null; suggestions: Suggestion[] }) {
  if (!pace) return null;
  return (
    <div className="mb-6 rounded-2xl bg-night-2 p-4">
      <p className="text-sm text-white/70">
        {paceLine(pace)}
        {pace.arrivals.length > 1 && <span className="text-white/40"> Arrived at {pace.arrivals.map((m) => `${m} min`).join(", ")}.</span>}
      </p>
      {suggestions.length > 0 && (
        <ul className="mt-3 space-y-2.5">
          {suggestions.map((s) => (
            <li key={s.text} className="flex gap-2.5 text-sm">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-coral" aria-hidden />
              <span>
                <span className="text-white">{s.text}</span>
                <span className="block text-xs text-white/45">{s.evidence}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
