"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveUsername } from "@/app/actions";
import { FormError } from "@/components/onboarding-shell";

// The first thing we ask: a short name. The headhunter is named after it on Hello Minds, so
// it's chosen here, before anything is deployed, and can still be changed on the summary.
export function NameStep({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const handle = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);
  const timezone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  return (
    <form
      className="w-full"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveUsername(handle, timezone);
          if (r?.error) return setError(r.error);
          router.refresh();
        });
      }}
    >
      <label className="block">
        <span className="sr-only">Your first name</span>
        <input
          className="field h-14 text-lg"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your first name"
          autoFocus
          autoComplete="given-name"
          maxLength={24}
          required
        />
      </label>
      <p className="mt-3 text-sm text-muted">
        Your headhunter will be called{" "}
        <span className="font-mono text-white/80">{handle || "yourname"}-careerninja</span> on Hello Minds. Letters, numbers or dashes, 3 to 24 characters. If it is already in use, a number is added.
      </p>
      <FormError message={error} />
      <button className="btn btn-primary mt-8 h-12 w-full" disabled={pending || handle.length < 3}>
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
