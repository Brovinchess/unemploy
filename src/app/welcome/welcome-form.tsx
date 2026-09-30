"use client";

import { useActionState } from "react";
import { saveUsername } from "@/app/actions";
import { FormError } from "@/components/onboarding-shell";

export function WelcomeForm() {
  const [state, action, pending] = useActionState(saveUsername, undefined);
  const timezone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  return (
    <form action={action} className="max-w-md">
      <label htmlFor="username" className="text-sm font-semibold text-ink">
        Username
      </label>
      <input
        id="username"
        name="username"
        className="field mt-2"
        placeholder="e.g. sarah"
        autoComplete="username"
        autoCapitalize="none"
        required
        minLength={3}
        maxLength={24}
        pattern="[a-zA-Z0-9-]+"
      />
      <p className="mt-2 text-sm text-muted">Letters, numbers and dashes. You can&rsquo;t change it later.</p>
      <input type="hidden" name="timezone" value={timezone} suppressHydrationWarning />
      <FormError message={state?.error} />
      <button className="btn btn-primary mt-8" disabled={pending}>
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
