"use client";

import { useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import { checkActivation, launchMind, simulateTopUp } from "@/app/actions";
import { FormError } from "@/components/onboarding-shell";

export function LaunchStep({ profileId }: { profileId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <div>
      <button
        className="btn btn-accent"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await launchMind(profileId);
            setError(r?.error);
          })
        }
      >
        {pending ? "Waking up your headhunter…" : "Launch my headhunter"}
      </button>
      {pending && (
        <p className="mt-4 text-sm text-muted" aria-live="polite">
          Choosing a name and creating your agent. This takes a few seconds.
        </p>
      )}
      <FormError message={error} />
    </div>
  );
}

export function ActivateStep({ profileId, topUpUrl, mock }: { profileId: string; topUpUrl: string; mock: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [openedTopUp, setOpenedTopUp] = useState(false);

  const check = (fn: () => ReturnType<typeof checkActivation>) =>
    start(async () => {
      const r = await fn();
      setError(r?.error);
    });

  return (
    <div className="max-w-xl">
      <div className="card p-6">
        <ol className="space-y-4 text-navy">
          <li className="flex items-center gap-4">
            <span className="font-display flex size-7 shrink-0 items-center justify-center rounded-full bg-coral-soft text-sm font-bold text-rose">1</span>
            <span>Open Hello Minds and add cognition to your new headhunter.</span>
          </li>
          <li className="flex items-center gap-4">
            <span className="font-display flex size-7 shrink-0 items-center justify-center rounded-full bg-coral-soft text-sm font-bold text-rose">2</span>
            <span>Come back here and press &ldquo;I&rsquo;ve topped up&rdquo;.</span>
          </li>
        </ol>
        <p className="mt-5 border-t border-line pt-4 text-sm text-muted">
          A headhunter looking for 5 jobs a day uses roughly 55 cognition a day (about $1). You choose the exact number
          in step 4.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href={topUpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-accent"
          onClick={() => setOpenedTopUp(true)}
        >
          Top up on Hello Minds <ExternalLink className="size-4" aria-hidden />
        </a>
        <button
          className={`btn ${openedTopUp ? "btn-primary" : "btn-ghost"}`}
          disabled={pending}
          onClick={() => check(() => checkActivation(profileId))}
        >
          {pending ? "Checking…" : "I’ve topped up"}
        </button>
      </div>

      {mock && (
        <p className="mt-6 text-sm text-muted">
          Demo mode:{" "}
          <button
            className="underline decoration-mist underline-offset-4 hover:text-navy"
            disabled={pending}
            onClick={() => check(async () => (await simulateTopUp(profileId)) ?? {})}
          >
            simulate a top-up of 160 cognition
          </button>
        </p>
      )}
      <FormError message={error} />
    </div>
  );
}
