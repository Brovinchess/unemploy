"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkActivation, launchMind, simulateTopUp, type ActivationState } from "@/app/actions";
import { CognitionNote } from "@/components/cognition-note";
import { FormError } from "@/components/onboarding-shell";

const POLL_MS = 6000;

export function ActivateStep({
  profileId,
  ownCognition = false,
  mindName,
  topUpUrl,
  mock,
}: {
  profileId: string;
  ownCognition?: boolean; // set up, but it has no cognition yet: ask for a top-up
  mindName: string | null;
  topUpUrl: string;
  mock: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  // A Mind that exists but isn't hunting yet is just waiting for its free cognition: poll while that's so.
  const waiting = !!mindName;

  const done = useCallback(
    (r: ActivationState | undefined) => {
      if (r?.started) router.push(r.searching ? `/app?profile=${profileId}&welcome=1` : `/app?profile=${profileId}`);
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

  const costLine = <CognitionNote />;

  if (!mindName) {
    return (
      <div className="w-full">
        <div className="rounded-3xl bg-night-2 p-6">{costLine}</div>
        <button
          className="btn btn-accent mt-8 h-12 w-full"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await launchMind(profileId);
              if (r?.started) return done(r);
              setError(r?.error);
              router.refresh(); // deployed but its free cognition hasn't landed: show the waiting screen
            })
          }
        >
          {pending ? "Setting up your headhunter…" : "Start my first search"}
        </button>
        {pending && (
          <p className="mt-4 text-center text-sm text-white/55" aria-live="polite">
            Picking a name, waking it up and sending it your brief. This takes a few seconds.
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
          <Step n={1} done>
            <span className="font-medium text-white">{mindName}</span> is set up.
          </Step>
          <Step n={2}>
            {ownCognition ? "Add cognition on Hello Minds. Its first search starts as soon as it arrives." : <>As soon as its cognition arrives, it gets your brief and you&rsquo;re in.</>}
          </Step>
        </ol>
        <div className="mt-5 border-t border-white/[0.08] pt-4">{costLine}</div>
      </div>

      {ownCognition && (
        <a href={topUpUrl} target="_blank" rel="noopener noreferrer" className="btn btn-accent mt-8 h-12 w-full justify-center">
          Top up on Hello Minds
        </a>
      )}
      {waiting ? (
        <p className="mt-8 flex items-center justify-center gap-2.5 text-sm text-white/55" aria-live="polite">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-coral opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-coral" />
          </span>
          {ownCognition ? "Waiting for your top-up…" : "Waiting for its cognition to arrive…"}
          <button
            className="text-white/80 underline decoration-white/30 underline-offset-4 hover:text-white"
            disabled={pending}
            onClick={() => start(async () => done(await checkActivation(profileId)))}
          >
            Check now
          </button>
        </p>
      ) : null}
      {!ownCognition && (
      <p className="mt-6 text-center text-xs text-white/40">
        Still nothing after a few minutes? You can{" "}
        <a href={topUpUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-white/30 underline-offset-4 hover:text-white">
          top up on Hello Minds
        </a>{" "}
        and it will start the moment it arrives.
      </p>
      )}

      {mock && (
        <p className="mt-6 text-center text-sm text-white/45">
          Demo mode:{" "}
          <button
            className="underline decoration-white/30 underline-offset-4 hover:text-white"
            disabled={pending}
            onClick={() => start(async () => done(await simulateTopUp(profileId)))}
          >
            simulate the cognition arriving
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
