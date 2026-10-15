"use client";

import { useState, useTransition } from "react";
import { setPaused } from "@/app/actions";

export function PauseToggle({ profileId, paused }: { profileId: string; paused: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <button
        className={`btn ${paused ? "btn-primary" : "btn-ghost"}`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setPaused(profileId, !paused);
            setError(r?.error);
          })
        }
      >
        {pending ? "Updating…" : paused ? "Resume headhunter" : "Pause headhunter"}
      </button>
      {error && <span className="text-sm text-rose">{error}</span>}
    </span>
  );
}
