"use client";

import { useActionState } from "react";
import { saveApplicantDetails } from "@/app/extension-actions";
import type { ApplicantDetails } from "@/db/schema";

const FIELDS: { name: keyof ApplicantDetails; label: string; placeholder: string; required?: boolean; type?: string }[] = [
  { name: "firstName", label: "First name", placeholder: "Alex", required: true },
  { name: "lastName", label: "Last name", placeholder: "Tan", required: true },
  { name: "email", label: "Email for applications", placeholder: "you@example.com", required: true, type: "email" },
  { name: "phone", label: "Phone", placeholder: "+60 12-345 6789", required: true, type: "tel" },
  { name: "location", label: "Where you live", placeholder: "Kuala Lumpur, Malaysia", required: true },
  { name: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/…" },
  { name: "website", label: "Website or portfolio", placeholder: "https://…" },
  { name: "workAuthorization", label: "Right to work", placeholder: "Malaysian citizen, no sponsorship needed" },
  { name: "noticePeriod", label: "Notice period", placeholder: "1 month" },
  { name: "salaryExpectation", label: "Salary expectation", placeholder: "MYR 20,000 a month" },
];

// What the Chrome extension types into application forms.
export function ApplicantForm({ initial }: { initial: ApplicantDetails | null }) {
  const [state, action, pending] = useActionState(saveApplicantDetails, undefined);
  return (
    <form action={action}>
      <p className="mb-5 text-white/60">The Chrome extension types these into application forms. Your headhunter writes the rest.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.name} className="block text-sm">
            <span className="text-white/70">
              {f.label}
              {f.required && <span className="text-coral"> *</span>}
            </span>
            <input
              name={f.name}
              type={f.type ?? "text"}
              defaultValue={initial?.[f.name] ?? ""}
              placeholder={f.placeholder}
              required={f.required}
              className="field mt-1.5 h-11"
            />
          </label>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-4">
        <button className="btn btn-accent" disabled={pending}>
          {pending ? "Saving…" : "Save details"}
        </button>
        {state?.ok && <span className="text-sm text-white/60">Saved.</span>}
        {state?.error && <span className="text-sm text-rose">{state.error}</span>}
      </div>
    </form>
  );
}
