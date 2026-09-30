"use client";

import { useActionState, useState } from "react";
import { createProfile } from "@/app/actions";
import { FormError } from "@/components/onboarding-shell";

const SUGGESTIONS = ["Design", "Engineering", "Product", "Marketing", "Sales", "Finance", "Operations"];

export function NewProfileForm({ username }: { username: string }) {
  const [state, action, pending] = useActionState(createProfile, undefined);
  const [label, setLabel] = useState("");
  const preview = `${username}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "…"}`;

  return (
    <form action={action} className="max-w-md">
      <label htmlFor="label" className="text-sm font-semibold text-ink">
        Job area
      </label>
      <input
        id="label"
        name="label"
        className="field mt-2"
        placeholder="e.g. Design"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        required
        maxLength={40}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="chip text-sm" aria-pressed={label === s} onClick={() => setLabel(s)}>
            {s}
          </button>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted">
        Your headhunter will be called <span className="rounded-md bg-mist-soft px-1.5 py-0.5 font-mono text-[0.8125rem] text-ink">{preview}</span>
      </p>
      <FormError message={state?.error} />
      <button className="btn btn-primary mt-8" disabled={pending || label.trim().length < 2}>
        {pending ? "Creating…" : "Continue"}
      </button>
    </form>
  );
}
