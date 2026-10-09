"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Download, Puzzle, Rocket, X } from "lucide-react";
import { connectExtension } from "@/app/extension-actions";
import { useExtension } from "./use-extension";

const STORE_URL = process.env.NEXT_PUBLIC_EXTENSION_STORE_URL;

// "Apply to all N": runs the extension if it's ready, otherwise explains what's missing.
export function ApplyAllButton({ count, detailsComplete }: { count: number; detailsComplete: boolean }) {
  const { status, applyAll } = useExtension();
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();
  if (!count) return null;

  const ready = status?.installed && status.connected && detailsComplete;
  const label = `Apply to all ${count} with the extension`;

  // Not set up yet: a quiet one-liner instead of a button that can't work.
  if (!ready) {
    const needDetails = !detailsComplete && status?.installed && status.connected;
    return (
      <p className="text-center text-sm text-white/45">
        {needDetails ? "Add your application details" : "Set up the Chrome extension"} to apply to all {count} in one go.{" "}
        <Link href={needDetails ? "/app/you#application" : "/app/settings#extension"} className="text-white/75 underline underline-offset-2 hover:text-white">
          {needDetails ? "Add details" : "Set up"}
        </Link>
      </p>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-b from-[#d27375] to-coral px-6 text-sm font-semibold text-white disabled:opacity-60"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await applyAll();
            setMsg(
              r?.ok
                ? `Opening ${r.count} applications one by one. Check each form, then press Submit.`
                : r?.reason === "empty"
                  ? "None of these jobs are on sites the extension can fill yet. Apply to them from their job page."
                  : "Couldn't start. Open the extension and try again.",
            );
          })
        }
      >
        <Rocket className="size-4" /> {pending ? "Starting…" : label}
      </button>
      {msg && <p className="max-w-sm text-center text-xs text-white/50">{msg}</p>}
    </div>
  );
}

// A card nudging people to install the extension, until it's installed and connected.
// Shown only when there's something to apply to.
export function ExtensionPrompt({ show = true }: { show?: boolean }) {
  const { status } = useExtension();
  // Nothing renders until the extension check finishes, so reading storage here is safe.
  const [hidden, setHidden] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem("cn-ext-prompt") === "hidden";
    } catch {
      return false;
    }
  });
  if (!show || !status || (status.installed && status.connected) || hidden) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-coral/25 bg-coral/10 px-5 py-4">
      <Puzzle className="size-6 shrink-0 text-rose" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-white">{status.installed ? "Connect the Chrome extension" : "Get the Chrome extension"}</p>
        <p className="text-sm text-white/60">Fills in every application. One click applies to all your To-apply jobs.</p>
      </div>
      <Link href="/app/settings#extension" className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-rose">
        {status.installed ? "Connect" : "Install"}
      </Link>
      <button
        className="text-white/40 hover:text-white"
        aria-label="Hide"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem("cn-ext-prompt", "hidden");
          } catch {}
        }}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

// The setup steps, in Settings.
export function ExtensionSetup({ detailsComplete, toApply }: { detailsComplete: boolean; toApply: number }) {
  const { status, connect, refresh } = useExtension();
  const [pending, start] = useTransition();
  const installed = !!status?.installed;
  const connected = !!status?.connected;

  return (
    <ol className="space-y-4">
      <Step n={1} done={installed} title="Install the extension">
        {STORE_URL ? (
          <a href={STORE_URL} target="_blank" rel="noopener noreferrer" className="btn btn-accent mt-3">
            <Puzzle className="size-4" /> Add to Chrome
          </a>
        ) : (
          <>
            <p className="mt-1 text-sm text-white/55">It&rsquo;s not in the Chrome Web Store yet, so install it in a minute by hand:</p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-white/75">
              <li>
                <a href="/career-ninja-extension.zip" className="inline-flex items-center gap-1 text-rose underline underline-offset-2">
                  Download the extension <Download className="size-3.5" />
                </a>{" "}
                and unzip it.
              </li>
              <li>
                In Chrome, open <span className="font-mono text-white">chrome://extensions</span> and switch on <b>Developer mode</b> (top right).
              </li>
              <li>
                Click <b>Load unpacked</b> and choose the unzipped <span className="font-mono text-white">career-ninja-extension</span> folder.
              </li>
              <li>Come back here and refresh this page.</li>
            </ol>
          </>
        )}
        {!installed && (
          <button className="mt-3 text-sm text-white/50 underline underline-offset-2 hover:text-white" onClick={() => location.reload()}>
            I&rsquo;ve installed it, check again
          </button>
        )}
      </Step>

      <Step n={2} done={connected} title="Connect it to your account">
        <p className="mt-1 text-sm text-white/55">So it can fetch your To-apply jobs and the applications your headhunter wrote.</p>
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
            {pending ? "Connecting…" : "Connect extension"}
          </button>
        )}
      </Step>

      <Step n={3} done={detailsComplete} title="Add your application details">
        <p className="mt-1 text-sm text-white/55">Your name, email, phone and location, plus answers to common questions like notice period.</p>
        {!detailsComplete && (
          <Link href="/app/you#application" className="btn btn-accent mt-3">
            Add details
          </Link>
        )}
      </Step>

      <Step n={4} done={false} title="Apply to all">
        <p className="mt-1 text-sm text-white/55">
          {toApply
            ? `You have ${toApply} ${toApply === 1 ? "job" : "jobs"} to apply to. The extension opens each one, fills it in and waits for you to check and submit.`
            : "Swipe right on a few jobs first, then come back here."}
        </p>
        <div className="mt-3">
          <ApplyAllButton count={toApply} detailsComplete={detailsComplete} />
        </div>
      </Step>
    </ol>
  );
}

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4 rounded-3xl bg-surface p-6">
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          done ? "bg-coral text-white" : "border border-white/15 text-white/60"
        }`}
      >
        {done ? <Check className="size-4" strokeWidth={3} /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-medium text-white">{title}</p>
        {children}
      </div>
    </li>
  );
}
