"use client";

import { useState, useTransition } from "react";
import { Check, ExternalLink, X } from "lucide-react";
import { Ninja } from "@/components/brand";
import { useLive } from "@/components/live";
import {
  activatePersonalMind,
  createPersonalMind,
  ignoreQuestion,
  saveQuestionAnswer,
  simulatePersonalTopUp,
  type PersonalState,
} from "@/app/personal-actions";

export function PersonalMindCard({
  state,
  name,
  balance: balanceProp,
  waiting: waitingProp,
  answering: answeringProp,
  topUpUrl,
  mock,
}: {
  state: "none" | "unfunded" | "ready";
  name: string | null;
  balance: number | null;
  waiting: number;
  answering: number;
  topUpUrl: string;
  mock: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<PersonalState>();
  const run = (fn: () => Promise<PersonalState | void>) => start(async () => setResult((await fn()) ?? undefined));
  const live = useLive();
  const balance = live?.answers.balance ?? balanceProp;
  const waiting = live?.answers.waiting ?? waitingProp;
  const answering = live?.answers.asked ?? answeringProp;

  return (
    <section className="flex flex-col gap-5 rounded-3xl bg-surface p-6 sm:flex-row sm:items-start md:p-8">
      <Ninja mood={answering ? "thinking" : state === "ready" ? "sleeping" : "happy"} className={`size-14 shrink-0 ${answering ? "float" : ""}`} />
      <div className="min-w-0 flex-1">
        {state === "none" && (
          <>
            <h2 className="font-display text-xl font-medium text-white">Meet your personal Mind</h2>
            <p className="mt-2 max-w-xl leading-relaxed text-white/60">
              A second Mind that only knows you: your resume, your details and every answer you give. After each search it
              answers the form questions your headhunter found, then goes back to sleep.
            </p>
            <button className="btn btn-accent mt-5" disabled={pending} onClick={() => run(createPersonalMind)}>
              {pending ? "Creating…" : "Create my personal Mind"}
            </button>
          </>
        )}

        {state === "unfunded" && (
          <>
            <h2 className="font-display text-xl font-medium text-white">
              Top up <span className="font-mono text-[0.9em]">{name}</span>
            </h2>
            <p className="mt-2 max-w-xl leading-relaxed text-white/60">
              Your personal Mind needs a little cognition before it can read your resume. Answering a batch of questions
              costs far less than a search.
            </p>
            <p className="mt-2 text-sm text-white/45">Balance: {balance == null ? "–" : Math.round(balance)}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href={topUpUrl} target="_blank" rel="noopener noreferrer" className="btn btn-accent">
                Top up on Hello Minds <ExternalLink className="size-4" aria-hidden />
              </a>
              <button className="btn btn-ghost" disabled={pending} onClick={() => run(activatePersonalMind)}>
                {pending ? "Checking…" : "I’ve topped up"}
              </button>
              {mock && (
                <button className="btn btn-ghost" disabled={pending} onClick={() => run(simulatePersonalTopUp)}>
                  Simulate top-up
                </button>
              )}
            </div>
          </>
        )}

        {state === "ready" && (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-xl font-medium text-white">
                <span className="font-mono text-[0.9em]">{name}</span>
              </h2>
              <span className="text-sm text-white/45">{balance == null ? "" : `${Math.round(balance)} cognition`}</span>
            </div>
            <p className="mt-2 flex items-center gap-2 text-white/65">
              {answering ? (
                <>
                  <span className="size-2 animate-pulse rounded-full bg-coral" /> Answering {answering}{" "}
                  {answering === 1 ? "question" : "questions"}…
                </>
              ) : waiting ? (
                <>
                  {waiting} {waiting === 1 ? "question" : "questions"} queued. They go to it by themselves, during or right after the
                  search.
                </>
              ) : (
                <>Asleep. It wakes after each search to answer that search&rsquo;s form questions.</>
              )}
            </p>
            <a href={topUpUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm text-white/45 hover:text-white">
              Top up
            </a>
          </>
        )}
        {result?.error && <p className="mt-3 text-sm text-rose">{result.error}</p>}
        {result?.ok && <p className="mt-3 text-sm text-white/60">{result.ok}</p>}
      </div>
    </section>
  );
}

type Item = { id: string; question: string; options: string[]; answer: string; note: string | null; company: string | null };

export function QuestionList({ items, mode, empty }: { items: Item[]; mode: "answer" | "review"; empty: string }) {
  if (!items.length) return <p className="mt-4 text-sm text-white/35">{empty}</p>;
  return (
    <ul className="mt-4 divide-y divide-white/[0.06]">
      {items.map((q) => (
        <QuestionRow key={q.id} item={q} mode={mode} />
      ))}
    </ul>
  );
}

function QuestionRow({ item, mode }: { item: Item; mode: "answer" | "review" }) {
  const [value, setValue] = useState(item.answer);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  // The row goes away the moment you decide; it only comes back if the save failed.
  const [gone, setGone] = useState(false);
  const save = (v = value) =>
    start(async () => {
      setGone(true);
      const r = await saveQuestionAnswer(item.id, v);
      if (r?.error) {
        setGone(false);
        setError(r.error);
      }
    });
  const skip = () =>
    start(async () => {
      setGone(true);
      await ignoreQuestion(item.id);
    });
  if (gone) return null;

  return (
    <li className="py-4">
      <p className="text-white">{item.question}</p>
      <p className="mt-0.5 text-xs text-white/40">
        {item.company && <>Asked by {item.company}</>}
        {mode === "review" && item.note && <> · {item.note}</>}
      </p>
      {item.options.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.options.map((o) => (
            <button
              key={o}
              disabled={pending}
              aria-pressed={value === o}
              onClick={() => (mode === "answer" ? (setValue(o), save(o)) : setValue(o))}
              className="chip min-h-9 px-3.5 text-sm"
            >
              {o}
            </button>
          ))}
        </div>
      ) : (
        <textarea
          className="field mt-3 min-h-[44px] py-2.5"
          rows={value.length > 80 ? 3 : 1}
          value={value}
          placeholder="Your answer"
          onChange={(e) => setValue(e.target.value)}
        />
      )}
      <div className="mt-3 flex items-center gap-3">
        {(mode === "review" || !item.options.length) && (
          <button className="btn btn-primary btn-sm" disabled={pending || !value.trim()} onClick={() => save()}>
            <Check className="size-4" aria-hidden /> {mode === "review" ? (value === item.answer ? "Approve" : "Save") : "Save"}
          </button>
        )}
        <button className="inline-flex items-center gap-1 text-sm text-white/40 hover:text-white" disabled={pending} onClick={skip}>
          <X className="size-3.5" aria-hidden /> Skip
        </button>
        {error && <span className="text-sm text-rose">{error}</span>}
      </div>
    </li>
  );
}
