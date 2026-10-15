"use client";

import { useState, useTransition } from "react";
import { removeProfile } from "@/app/actions";

export function RemoveHeadhunter({ profileId, mindName }: { profileId: string; mindName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button className="btn btn-ghost text-rose" onClick={() => setConfirming(true)}>
        Remove this headhunter
      </button>
    );
  }
  return (
    <div className="w-full rounded-2xl bg-coral-soft px-5 py-4">
      <p>
        This turns off <span className="font-mono">{mindName}</span> and deletes your jobs and tracker. Any cognition left on it
        stays on Hello Minds. This can&rsquo;t be undone.
      </p>
      <div className="mt-4 flex gap-3">
        <button className="btn btn-accent" disabled={pending} onClick={() => start(() => removeProfile(profileId))}>
          {pending ? "Removing…" : "Yes, remove it"}
        </button>
        <button className="btn btn-ghost" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
