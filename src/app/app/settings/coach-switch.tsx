"use client";

import { useState, useTransition } from "react";
import { setCoachReminders } from "@/app/notify-actions";

// Whether the app suggests changes before a search, after a slow one.
export function CoachSwitch({ on: initial }: { on: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <label className="flex items-start gap-3 text-white/70">
      <input
        type="checkbox"
        className="mt-1"
        checked={on}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.checked;
          setOn(v);
          start(() => setCoachReminders(v));
        }}
      />
      <span>
        <span className="block text-white">Suggest changes after a slow search</span>
        <span className="block text-sm text-white/50">
          When a search took over 15 minutes per job, show what to change before the next one. Ticking &ldquo;Don&rsquo;t remind me&rdquo; turns this off.
        </span>
      </span>
    </label>
  );
}
