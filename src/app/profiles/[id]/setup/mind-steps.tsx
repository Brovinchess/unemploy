"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { checkActivation, launchMind, simulateTopUp, type ActivationState } from "@/app/actions";
import { FormError } from "@/components/onboarding-shell";

const POLL_MS = 6000;

export function ActivateStep({
  profileId,
  mindName,
  jobsPerDay,
  cost,
  topUpUrl,
  mock,
}: {
  profileId: string;
  mindName: string | null;
  jobsPerDay: number;
  cost: { cognition: number; usd: number };
  topUpUrl: string;
  mock: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [waiting, setWaiting] = useState(false);

  const done = useCallback(
    (r: ActivationState | undefined) => {
      if (r?.started) router.push(`/app?profile=${profileId}&welcome=1`);
      else setError(r?.error);
    },
    [router, profileId],
  );

  // Once they've gone to top up, keep checking quietly until the cognition lands.
  useEffect(() => {
    if (!waiting) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const r = await checkActivation(profileId, true);
      if (stop) return;
      if (r.started || r.error) return done(r);
      timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [waiting, profileId, done]);

  const costLine = (
    <p className="text-sm text-white/55">
      It only searches when you ask. A search for {jobsPerDay} jobs uses about{" "}
      <span className="text-white">{cost.cognition} cognition</span> (~${cost.usd.toFixed(2)}). Between searches it&rsquo;s switched off and spends nothing.
    </p>
  );

  if (!mindName) {
    return (
      <div className="w-full">
        <div className="rounded-3xl bg-night-2 p-6">{costLine}</div>
        <button
          className="btn btn-accent mt-8 h-12 w-full"
          disabled={pending}
          onClick={() => start(async () => setError((await launchMind(profileId))?.error))}
        >
          {pending ? "Creating your headhunter…" : "Create my headhunter"}
        </button>
        {pending && (
          <p className="mt-4 text-center text-sm text-white/55" aria-live="polite">
            Picking a name and waking it up. This takes a few seconds.
          </p>
        )}
        <FormError message={error} />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="rounded-3xl bg-night-2 p-6">
        <ol className="space-y-4">
          <Step n={1} done={waiting}>
            Add cognition to <span className="font-medium text-white">{mindName}</span> on Hello Minds.
          </Step>
          <Step n={2}>Come back here. We&rsquo;ll notice the top-up and start your search.</Step>
        </ol>
        <div className="mt-5 border-t border-white/[0.08] pt-4">{costLine}</div>
      </div>

      <a
        href={topUpUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-accent mt-8 h-12 w-full"
        onClick={() => setWaiting(true)}
      >
        Top up on Hello Minds <ExternalLink className="size-4" aria-hidden />
      </a>

      {waiting ? (
        <p className="mt-5 flex items-center justify-center gap-2.5 text-sm text-white/55" aria-live="polite">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-coral opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-coral" />
          </span>
          Waiting for your top-up…
          <button
            className="text-white/80 underline decoration-white/30 underline-offset-4 hover:text-white"
            disabled={pending}
            onClick={() => start(async () => done(await checkActivation(profileId)))}
          >
            Check now
          </button>
        </p>
      ) : (
        <button
          className="mt-4 w-full text-center text-sm text-white/55 hover:text-white"
          disabled={pending}
          onClick={() => start(async () => done(await checkActivation(profileId)))}
        >
          {pending ? "Checking…" : "Already topped up? Check now"}
        </button>
      )}

      {mock && (
        <p className="mt-6 text-center text-sm text-white/45">
          Demo mode:{" "}
          <button
            className="underline decoration-white/30 underline-offset-4 hover:text-white"
            disabled={pending}
            onClick={() => start(async () => done(await simulateTopUp(profileId)))}
          >
            simulate a top-up of 160 cognition
          </button>
        </p>
      )}
      <FormError message={error} />
    </div>
  );
}

function Step({ n, done = false, children }: { n: number; done?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-4 text-white/80">
      <span
        className={`font-display flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          done ? "bg-coral text-white" : "bg-white/[0.08] text-white/80"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <span>{children}</span>
    </li>
  );
}
