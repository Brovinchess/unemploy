"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Pencil, Search, Trash2 } from "lucide-react";
import { deleteSavedAnswer, updateSavedAnswer } from "@/app/extension-actions";
import { DETAIL_LABELS, TOPIC_LABELS, topicOf, type DetailField, type Topic } from "@/lib/answers";

type Item = { question: string; answer: string; updatedAt: string; field: string | null };

const RECENT = 5;
const ORDER: Topic[] = ["eligibility", "availability", "experience", "pay", "other"];

// Answers learnt from forms, reused by the extension. Short by design: the common ones live
// in application details, the newest five show first, and the rest are grouped by topic
// behind "Show all" with a search box.
export function SavedAnswers({ answers }: { answers: Item[] }) {
  const [all, setAll] = useState(false);
  const [q, setQ] = useState("");
  const promoted = answers.filter((a) => a.field);
  const listed = answers.filter((a) => !a.field);

  if (!answers.length) {
    return (
      <p className="text-white/55">
        Nothing yet. Answers you approve or type, and ones you give on forms, are remembered here and filled in next time.
        Diversity questions are never saved.
      </p>
    );
  }

  const needle = q.trim().toLowerCase();
  const matches = needle ? listed.filter((a) => `${a.question} ${a.answer}`.toLowerCase().includes(needle)) : listed;
  const showAll = all || !!needle;

  return (
    <div>
      {promoted.length > 0 && (
        <p className="mb-4 text-sm text-white/50">
          {promoted.length} {promoted.length === 1 ? "answer" : "answers"} ({[...new Set(promoted.map((a) => DETAIL_LABELS[a.field as DetailField] ?? a.field))].join(", ").toLowerCase()}) live in your{" "}
          <Link href="#application" className="text-white/75 underline-offset-2 hover:underline">
            application details
          </Link>{" "}
          above.
        </p>
      )}

      {listed.length > RECENT && (
        <label className="relative mb-4 block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/35" aria-hidden />
          <input className="field h-10 pl-10" placeholder={`Search ${listed.length} saved answers`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search saved answers" />
        </label>
      )}

      {!showAll ? (
        <>
          <ul className="divide-y divide-white/[0.06]">
            {listed.slice(0, RECENT).map((a) => (
              <Row key={a.question} item={a} />
            ))}
          </ul>
          {listed.length > RECENT && (
            <button className="mt-3 text-sm text-white/55 hover:text-white" onClick={() => setAll(true)}>
              Show all {listed.length}, by topic
            </button>
          )}
        </>
      ) : matches.length === 0 ? (
        <p className="text-sm text-white/40">No saved answer matches &ldquo;{q}&rdquo;.</p>
      ) : (
        <div className="space-y-6">
          {ORDER.map((topic) => {
            const items = matches.filter((a) => topicOf(a.question) === topic);
            if (!items.length) return null;
            return (
              <section key={topic}>
                <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-white/35">
                  {TOPIC_LABELS[topic]} <span className="font-normal normal-case tracking-normal">· {items.length}</span>
                </h3>
                <ul className="mt-1 divide-y divide-white/[0.06]">
                  {items.map((a) => (
                    <Row key={a.question} item={a} />
                  ))}
                </ul>
              </section>
            );
          })}
          {!needle && (
            <button className="text-sm text-white/55 hover:text-white" onClick={() => setAll(false)}>
              Show fewer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ item }: { item: Item }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.answer);
  const [pending, start] = useTransition();
  const [gone, setGone] = useState(false);
  if (gone) return null;
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
        onClick={() =>
          start(async () => {
            setGone(true);
            await deleteSavedAnswer(item.question);
          })
        }
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}
