"use client";

import { useState, useTransition } from "react";
import { Check, Pencil } from "lucide-react";
import { renameProfile } from "@/app/actions";

export function RenameHeadhunter({ profileId, label }: { profileId: string; label: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (!editing) {
    return (
      <button className="flex items-center gap-2 text-white/80 hover:text-white" onClick={() => setEditing(true)}>
        {label} <Pencil className="size-3.5 text-white/40" aria-hidden />
        <span className="sr-only">Rename</span>
      </button>
    );
  }
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await renameProfile(profileId, value);
          if (r?.error) setError(r.error);
          else setEditing(false);
        });
      }}
    >
      <input className="field h-10 max-w-60" value={value} onChange={(e) => setValue(e.target.value)} autoFocus maxLength={40} aria-label="Headhunter name" />
      <button className="btn btn-primary h-10" disabled={pending}>
        <Check className="size-4" aria-hidden /> Save
      </button>
      {error && <span className="text-sm text-rose">{error}</span>}
    </form>
  );
}
