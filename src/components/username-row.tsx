"use client";

import { useState, useTransition } from "react";
import { Check, Pencil } from "lucide-react";
import { renameUsername } from "@/app/actions";

// The handle we picked from the resume, shown on the summary with a way to change it before
// the headhunter is deployed under that name.
export function UsernameRow({ username }: { username: string }) {
  const [name, setName] = useState(username);
  const [draft, setDraft] = useState(username);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const r = await renameUsername(draft.trim());
      if (r?.error) return setError(r.error);
      setError(undefined);
      setName(r?.username ?? draft);
      setEditing(false);
    });

  return (
    <div id="pref-username" className="flex items-start justify-between gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">Your name</p>
        {editing ? (
          <form
            className="mt-1.5 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <input
              className="field h-10 min-h-0 flex-1 rounded-xl text-sm"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              maxLength={24}
              aria-label="Your name"
            />
            <button className="btn btn-accent h-10 px-3" disabled={pending || draft.trim().length < 3} aria-label="Save name">
              <Check className="size-4" />
            </button>
          </form>
        ) : (
          <p className="mt-0.5 font-medium text-ink">{name}</p>
        )}
        <p className="mt-1 text-xs text-white/45">
          Your headhunter will be called <span className="font-mono text-white/70">{(editing ? draft : name).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "you"}-careerninja</span>.
        </p>
        {error && <p className="mt-1 text-sm text-rose">{error}</p>}
      </div>
      {!editing && (
        <button className="mt-1 text-muted hover:text-navy" aria-label="Change your name" onClick={() => setEditing(true)}>
          <Pencil className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
