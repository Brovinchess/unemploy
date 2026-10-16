"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import type { ApplicantDetails } from "@/db/schema";
import type { GuessedDetails } from "@/lib/normalise";
import { ApplicantForm } from "../settings/applicant-form";

// The details as short lines, with one Edit that opens the full form in place. Gaps the
// headhunter needs most are called out: they are what makes questions land on the person.
const LINES: { key: keyof ApplicantDetails; label: string; ask?: boolean }[] = [
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "location", label: "Lives in" },
  { key: "currentTitle", label: "Current title", ask: true },
  { key: "currentCompany", label: "Current company", ask: true },
  { key: "workAuthorization", label: "Right to work", ask: true },
  { key: "noticePeriod", label: "Notice period", ask: true },
  { key: "salaryExpectation", label: "Salary expectation" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "website", label: "Website" },
];

export function DetailsCard({ initial, suggested }: { initial: ApplicantDetails | null; suggested?: GuessedDetails }) {
  const [editing, setEditing] = useState(!initial);
  // First-time save: the form had no Cancel, so it closes itself once details exist.
  const had = useRef(!!initial);
  useEffect(() => {
    if (initial && !had.current) setEditing(false);
    had.current = !!initial;
  }, [initial]);
  const name = [initial?.firstName, initial?.lastName].filter(Boolean).join(" ");
  const filled = LINES.filter((l) => initial?.[l.key]?.trim());
  const gaps = LINES.filter((l) => l.ask && !initial?.[l.key]?.trim());

  return (
    <section id="application" className="scroll-mt-8 rounded-3xl bg-surface p-6 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display font-medium text-white">Your details</h2>
          <p className="mt-1 text-sm text-white/50">What your headhunter writes on forms about you.</p>
        </div>
        {!editing && (
          <button className="btn btn-ghost btn-sm shrink-0" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" aria-hidden /> Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-5">
          <ApplicantForm initial={initial} suggested={suggested} onDone={initial ? () => setEditing(false) : undefined} />
        </div>
      ) : (
        <>
          {name && <p className="mt-5 text-lg text-white">{name}</p>}
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-sm">
            {filled.map((l) => (
              <div key={l.key} className="contents">
                <dt className="text-white/45">{l.label}</dt>
                <dd className="min-w-0 truncate text-white/85">{initial![l.key]}</dd>
              </div>
            ))}
          </dl>
          {gaps.length > 0 && (
            <div className="mt-5 rounded-2xl bg-white/[0.04] p-4 text-sm">
              <p className="text-white/70">Forms ask for these often. Fill them in and fewer questions land here.</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {gaps.map((g) => (
                  <button key={g.key} className="chip min-h-8 px-3 text-xs" onClick={() => setEditing(true)}>
                    + {g.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
