"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "@/app/actions";

export function DeleteAccount() {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button className="btn btn-ghost text-rose" onClick={() => setConfirming(true)}>
        Delete my data
      </button>
    );
  }
  return (
    <div className="w-full rounded-2xl bg-coral-soft px-5 py-4">
      <p>
        This deletes your resumes, shortlists and tracker, and turns off all your headhunters. Hello Minds keeps the
        agents themselves. This can&rsquo;t be undone.
      </p>
      <div className="mt-4 flex gap-3">
        <button className="btn btn-accent" disabled={pending} onClick={() => start(() => deleteAccount())}>
          {pending ? "Deleting…" : "Yes, delete everything"}
        </button>
        <button className="btn btn-ghost" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
