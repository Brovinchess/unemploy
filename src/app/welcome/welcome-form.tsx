"use client";

import { useActionState, useState } from "react";
import { saveUsername } from "@/app/actions";
import { FormError } from "@/components/onboarding-shell";


const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function WelcomeForm() {
  const [state, action, pending] = useActionState(saveUsername, undefined);
  const [username, setUsername] = useState("");
  const timezone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const mindName = `${slug(username) || "you"}-careerninja`;

  return (
    <form action={action} className="w-full">
      <label htmlFor="username" className="text-sm font-medium text-white">
        What should we call you?
      </label>
      <input
        id="username"
        name="username"
        className="field mt-2"
        placeholder="e.g. sarah"
        autoComplete="username"
        autoCapitalize="none"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        minLength={3}
        maxLength={24}
        pattern="[a-zA-Z0-9-]+"
      />
      <p className="mt-2 text-sm text-white/45">Letters, numbers and dashes. You can&rsquo;t change it later.</p>

      <p className="mt-8 rounded-2xl bg-night-2 px-4 py-3 text-sm text-white/55">
        Your headhunter will be called <span className="font-mono text-white">{mindName}</span>.
      </p>
      <input type="hidden" name="timezone" value={timezone} suppressHydrationWarning />
      <FormError message={state?.error} />
      <button className="btn btn-primary mt-8 h-12 w-full" disabled={pending || username.length < 3}>
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
