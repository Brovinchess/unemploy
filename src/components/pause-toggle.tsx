"use client";

import { useTransition } from "react";
import { setPaused } from "@/app/actions";

export function PauseToggle({ profileId, paused }: { profileId: string; paused: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      className={`btn ${paused ? "btn-primary" : "btn-ghost"}`}
      disabled={pending}
      onClick={() => start(() => setPaused(profileId, !paused))}
    >
      {pending ? "Updating…" : paused ? "Resume headhunter" : "Pause headhunter"}
    </button>
  );
}
