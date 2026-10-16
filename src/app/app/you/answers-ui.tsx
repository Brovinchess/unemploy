"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { ignoreQuestion, saveQuestionAnswer } from "@/app/personal-actions";

export type Item = { id: string; question: string; options: string[]; answer: string; note: string | null; company: string | null };

// One list for everything waiting on the person. A row with an answer already in it is the
// headhunter's, taken from the details: approve or fix it. A bare row is for the person to answer.
const FIRST = 8;

// The first few questions, then the rest on request, so a long form doesn't bury the page.
export function QuestionList({ items }: { items: Item[] }) {
  const [all, setAll] = useState(items.length <= FIRST);
  const shown = all ? items : items.slice(0, FIRST);
  return (
    <>
      <ul className="mt-5 divide-y divide-white/[0.06]">
        {shown.map((q) => (
          <QuestionRow key={q.id} item={q} />
        ))}
      </ul>
      {!all && (
        <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={() => setAll(true)}>
          Show all {items.length}
        </button>
      )}
    </>
  );
}

function QuestionRow({ item }: { item: Item }) {
  const prefilled = !!item.answer;
  const [value, setValue] = useState(item.answer);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  // The row goes away the moment you decide; it only comes back if the save failed.
  const [gone, setGone] = useState(false);
  const save = () =>
    start(async () => {
      setGone(true);
      const r = await saveQuestionAnswer(item.id, value);
      if (r?.error) {
        setGone(false);
        setError(r.error);
      }
    });
  const skip = () =>
    start(async () => {
      setGone(true);
      try {
        await ignoreQuestion(item.id);
      } catch {
        setGone(false);
        setError("Couldn't skip that. Try again.");
      }
    });
  if (gone) return null;

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <p className="text-white">{item.question}</p>
      <p className="mt-0.5 text-xs text-white/40">
        {item.company && <>Asked by {item.company}</>}
        {prefilled && <>{item.company ? " · " : ""}{item.note?.startsWith("Usually") ? item.note : "Your headhunter\u2019s answer. Check it once."}</>}
      </p>
      {item.options.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.options.map((o) => (
            <button key={o} disabled={pending} aria-pressed={value === o} onClick={() => setValue(o)} className="chip min-h-9 px-3.5 text-sm">
              {o}
            </button>
          ))}
        </div>
      ) : (
        <textarea className="field mt-3 py-2.5" rows={value.length > 80 ? 4 : 2} value={value} placeholder="Your answer" onChange={(e) => setValue(e.target.value)} />
      )}
      <div className="mt-3 flex items-center gap-3">
        <button className="btn btn-primary btn-sm" disabled={pending || !value.trim()} onClick={save}>
          <Check className="size-4" aria-hidden /> {prefilled && value === item.answer ? "Approve" : "Save"}
        </button>
        <button className="inline-flex items-center gap-1 text-sm text-white/40 hover:text-white" disabled={pending} onClick={skip}>
          <X className="size-3.5" aria-hidden /> Skip
        </button>
        {error && <span className="text-sm text-rose">{error}</span>}
      </div>
    </li>
  );
}
