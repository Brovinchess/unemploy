"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import { deleteSavedAnswer, updateSavedAnswer } from "@/app/extension-actions";

// Answers learnt from forms the person filled in, reused by the extension.
export function SavedAnswers({ answers }: { answers: { question: string; answer: string }[] }) {
  if (!answers.length) {
    return (
      <p className="text-white/55">
        Nothing yet. When the extension can&rsquo;t fill a question and you answer it yourself, it remembers your answer here
        and uses it on the next form. Diversity questions are never saved.
      </p>
    );
  }
  return (
    <div>
      <p className="mb-4 text-white/55">The extension fills these in when a form asks the same question. Diversity questions are never saved.</p>
      <ul className="divide-y divide-white/[0.06]">
        {answers.map((a) => (
          <Row key={a.question} item={a} />
        ))}
      </ul>
    </div>
  );
}

function Row({ item }: { item: { question: string; answer: string } }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.answer);
  const [pending, start] = useTransition();
  return (
    <li className="flex items-start gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white/55">{item.question}</p>
        {editing ? (
          <input className="field mt-1.5 h-10" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        ) : (
          <p className="mt-0.5 text-white">{item.answer}</p>
        )}
      </div>
      {editing ? (
        <button
          className="mt-6 text-white/60 hover:text-white"
          disabled={pending}
          aria-label="Save"
          onClick={() => start(async () => (await updateSavedAnswer(item.question, value), setEditing(false)))}
        >
          <Check className="size-4" />
        </button>
      ) : (
        <button className="mt-1 text-white/40 hover:text-white" aria-label="Edit" onClick={() => setEditing(true)}>
          <Pencil className="size-4" />
        </button>
      )}
      <button
        className="mt-1 text-white/40 hover:text-rose"
        disabled={pending}
        aria-label="Delete"
        onClick={() => start(() => deleteSavedAnswer(item.question))}
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}
