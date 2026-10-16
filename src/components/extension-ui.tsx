"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Puzzle, Rocket } from "lucide-react";
import { connectExtension } from "@/app/extension-actions";
import { Ninja } from "./brand";
import { useExtension } from "./use-extension";
import { extensionLive } from "@/lib/flags";

// The Chrome Web Store listing (public since 16 Oct 2026).
const STORE_URL = process.env.NEXT_PUBLIC_EXTENSION_STORE_URL || "https://chromewebstore.google.com/detail/career-ninja/pegmolmikinefghoeollhdaaedbddkaa";

// "Apply to all N": runs the extension if it's ready, otherwise explains what's missing.
// `bar` lays it out as a slim row (text left, action right) for the top of the jobs list;
// the default stacks and centres it for the end of the swipe deck.
export function ApplyAllButton({
  count,
  other = 0, // kept jobs on sites the extension can't fill: applied to from the job page
  detailsComplete,
  bar = false,
  inSetup = false, // rendered inside the setup list itself: no "set up" link back to it
}: {
  count: number;
  other?: number;
  detailsComplete: boolean;
  bar?: boolean;
  inSetup?: boolean;
}) {
  const { status, applyAll } = useExtension();
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();
  if (!count && !other) return null;

  const ready = status?.installed && status.connected && detailsComplete && !status.needsUpdate;
  const needDetails = !detailsComplete && status?.installed && status.connected;
  const one = count === 1;

  const run = () =>
    start(async () => {
      const r = await applyAll();
      setMsg(
        r?.ok
          ? `Opening ${r.count} applications one by one. Check each form, then press Submit.`
          : r?.reason === "empty"
            ? "None of these jobs are on sites the extension can fill yet. Apply to them from their job page."
            : "Couldn't start. Open the extension and try again.",
      );
    });

  if (!extensionLive) {
    if (!bar) return null;
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-5 py-3.5">
        <Ninja mood="thinking" className="size-11 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white">
            {count} {one ? "job" : "jobs"} ready to apply
          </p>
          <p className="text-sm text-white/55">Open each job to apply with the application your headhunter wrote. Apply to all, with the Chrome extension, is coming soon.</p>
        </div>
      </div>
    );
  }

  if (bar) {
    // Nothing until the extension check finishes, so the row doesn't flash between states.
    if (!status) return null;
    if (!count) {
      return (
        <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-5 py-3.5">
          <Ninja mood="thinking" className="size-11 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-white">
              {other} {other === 1 ? "job" : "jobs"} ready to apply
            </p>
            <p className="text-sm text-white/55">Open each posting; the cover letter and answers are on the job&rsquo;s page.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-coral/20 bg-coral/[0.08] px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Ninja mood="love" className="float size-11 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-white">
              {count} {one ? "job" : "jobs"} ready for the extension
            </p>
            <p className="text-sm text-white/55">
              {msg ??
                (ready
                  ? "Fills in each form for you. You check it and press Submit."
                  : status.needsUpdate
                    ? "Your Career Ninja extension is out of date. Chrome updates it by itself. To do it now, open chrome://extensions and press Update."
                    : needDetails
                    ? "Add your application details and the extension can fill them in for you."
                    : "Set up the Chrome extension and apply to all of them in one go.")}
            </p>
          </div>
        </div>
        {ready ? (
          <button
            className="btn btn-accent h-10 w-full shrink-0 justify-center sm:w-auto"
            disabled={pending}
            onClick={run}
          >
            {pending
              ? "Starting…"
              : one
                ? "Apply with the extension"
                : `Apply to all ${count}`}
          </button>
        ) : (
          <Link
            href={
              needDetails ? "/app/you#application" : "/app/settings#extension"
            }
            className="btn btn-ghost h-10 w-full shrink-0 justify-center sm:w-auto"
          >
            {needDetails ? "Add details" : "Set up extension"}
          </Link>
        )}
      </div>
    );
  }

  if (!count) {
    return <p className={`text-sm text-white/50 ${inSetup ? "" : "text-center"}`}>Your {other} kept {other === 1 ? "job is" : "jobs are"} on sites the extension can&rsquo;t fill yet. Apply from the job page.</p>;
  }
  // Not set up yet: a quiet one-liner instead of a button that can't work.
  if (!ready) {
    if (inSetup) return <p className="text-sm text-white/45">Finish the three steps and the button appears here.</p>;
    return (
      <p className="text-center text-sm text-white/45">
        {needDetails
          ? "Add your application details"
          : "Set up the Chrome extension"}{" "}
        to apply to all {count} in one go.{" "}
        <Link
          href={
            needDetails ? "/app/you#application" : "/app/settings#extension"
          }
          className="text-white/75 underline underline-offset-2 hover:text-white"
        >
          {needDetails ? "Add details" : "Set up"}
        </Link>
      </p>
    );
  }
  return (
    <div className={`flex flex-col gap-2 ${inSetup ? "items-start" : "items-center"}`}>
      <button
        className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-b from-[#d27375] to-coral px-6 text-sm font-semibold text-white disabled:opacity-60"
        disabled={pending}
        onClick={run}
      >
        <Rocket className="size-4" />{" "}
        {pending ? "Starting…" : `Apply to all ${count} with the extension`}
      </button>
      {msg && (
        <p className={`max-w-sm text-xs text-white/50 ${inSetup ? "" : "text-center"}`}>{msg}</p>
      )}

    </div>
  );
}

// The setup, in Settings: three short steps with a tick each, the first undone one carrying
// its button, then how to use it in three lines, then the Apply button once everything is set.
export function ExtensionSetup({
  detailsComplete,
  toApply,
  other = 0,
}: {
  detailsComplete: boolean;
  toApply: number; // kept jobs the extension can fill
  other?: number; // kept jobs on other sites
}) {
  const { status, connect, refresh } = useExtension();
  const [pending, start] = useTransition();
  const installed = !!status?.installed;
  const connected = !!status?.connected;
  const allSet = installed && connected && detailsComplete;

  return (
    <div className="space-y-6">
      <ol className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.06]">
        <Step n={1} done={installed} title="Add it to Chrome" hint="Works in Chrome, Edge and Brave on a computer.">
          {!installed && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <a href={STORE_URL} target="_blank" rel="noopener noreferrer" className="btn btn-accent">
                <Puzzle className="size-4" /> Add to Chrome
              </a>
              <button className="text-sm text-white/50 underline underline-offset-2 hover:text-white" onClick={() => location.reload()}>
                Installed it? Check again
              </button>
            </div>
          )}
        </Step>

        <Step n={2} done={connected} title="Connect it to your account" hint={installed ? "One click. It can then fetch your kept jobs and their applications." : "After step 1."}>
          {installed && !connected && (
            <button
              className="btn btn-accent mt-3"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const { token } = await connectExtension();
                  await connect(token);
                  await refresh();
                })
              }
            >
              {pending ? "Connecting…" : "Connect"}
            </button>
          )}
        </Step>

        <Step n={3} done={detailsComplete} title="Fill in your details" hint="Name, email, phone and where you live, on the You page.">
          {!detailsComplete && (
            <Link href="/app/you#application" className="btn btn-accent mt-3">
              Go to You
            </Link>
          )}
        </Step>
      </ol>

      <div>
        <p className="font-display font-medium text-white">How to use it</p>
        <ol className="mt-2 space-y-1.5 text-sm text-white/65">
          <li>1. Swipe right on the jobs you want. Your headhunter writes each application.</li>
          <li>2. On the Jobs page, press Apply to all. The extension opens each job and fills in the form.</li>
          <li>3. Check the form and press Submit. It moves on to the next job.</li>
        </ol>
      </div>

      <div className="border-t border-white/[0.06] pt-5">
        {allSet ? (
          toApply || other ? (
            <ApplyAllButton count={toApply} other={other} detailsComplete={detailsComplete} inSetup />
          ) : (
            <p className="text-sm text-white/55">All set. Swipe right on a few jobs and the Apply to all button appears on the Jobs page.</p>
          )
        ) : (
          <p className="text-sm text-white/45">Finish the three steps and you can apply to every kept job in one go.</p>
        )}
      </div>
    </div>
  );
}

function Step({
  n,
  done,
  title,
  hint,
  children,
}: {
  n: number;
  done: boolean;
  title: string;
  hint: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex gap-4 px-5 py-4">
      <span
        className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          done ? "bg-coral text-white" : "border border-white/15 text-white/60"
        }`}
      >
        {done ? <Check className="size-3.5" strokeWidth={3} /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${done ? "text-white/70" : "text-white"}`}>{title}</p>
        {!done && <p className="mt-0.5 text-sm text-white/50">{hint}</p>}
        {children}
      </div>
    </li>
  );
}
