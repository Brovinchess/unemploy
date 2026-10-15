"use client";

import { useActionState, useEffect } from "react";
import { saveApplicantDetails } from "@/app/extension-actions";
import type { ApplicantDetails } from "@/db/schema";

const FIELDS: { name: keyof ApplicantDetails; label: string; placeholder: string; required?: boolean; type?: string }[] = [
  { name: "firstName", label: "First name", placeholder: "Alex", required: true },
  { name: "lastName", label: "Last name", placeholder: "Tan", required: true },
  { name: "email", label: "Email for applications", placeholder: "you@example.com", required: true, type: "email" },
  { name: "phone", label: "Phone", placeholder: "+60 12-345 6789", required: true, type: "tel" },
  { name: "location", label: "Where you live", placeholder: "New York, United States", required: true },
  { name: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/…" },
  { name: "website", label: "Website or portfolio", placeholder: "https://…" },
  { name: "currentCompany", label: "Current company", placeholder: "Acme" },
  { name: "currentTitle", label: "Current title", placeholder: "Product Manager" },
  { name: "workAuthorization", label: "Right to work", placeholder: "US citizen, no sponsorship needed" },
  { name: "noticePeriod", label: "Notice period", placeholder: "1 month" },
  { name: "salaryExpectation", label: "Salary expectation", placeholder: "USD 120,000 a year" },
];

// The person's application details: what the headhunter (and later the extension) puts on forms.
// `onDone` closes the form once saved, and gives it a Cancel.
export function ApplicantForm({ initial, onDone }: { initial: ApplicantDetails | null; onDone?: () => void }) {
  const [state, action, pending] = useActionState(saveApplicantDetails, undefined);
  useEffect(() => {
    if (state?.ok) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form action={action}>
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
        {onDone && (
          <button type="button" className="text-sm text-white/50 hover:text-white" onClick={onDone} disabled={pending}>
            Cancel
          </button>
        )}
        {state?.ok && !onDone && <span className="text-sm text-white/60">Saved.</span>}
        {state?.error && <span className="text-sm text-rose">{state.error}</span>}
      </div>
    </form>
  );
}
