"use client";

import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { minutesSince, useLive, useNow } from "./live";
import { useExtension } from "./use-extension";

// Measured on prod, 14 days to 27 Oct 2026: the first job lands at a median of 17 minutes
// (half of searches between 8 and 29). Past this, the wait is longer than most.
const LONG_MIN = 30;

// Under the first search's radar: how long it usually takes, whether they can leave, and a few
// things worth doing meanwhile. Each step is ticked once it's done, so the wait shows progress.
export function WhileYouWait({ profileId, startedAt, notifyEmail, detailsDone }: { profileId: string; startedAt: string | null; notifyEmail: string | null; detailsDone: boolean }) {
  const live = useLive();
  const now = useNow();
  const { status } = useExtension();
  const start = (live?.profile.id === profileId ? live.profile.startedAt : null) ?? startedAt;
  const long = start ? minutesSince(start, now) >= LONG_MIN : false;

  const steps = [
    { done: detailsDone, title: "Add your contact details", body: "Every application needs them.", href: "/app/you#application" },
    { done: !!(status?.installed && status.connected), title: "Install the Chrome extension", body: "It fills in application forms for you.", href: "/app/settings#extension", hidden: !status },
    { done: false, title: "Get an email when jobs arrive", body: "Then you don't have to keep this page open.", href: "/app/settings#email", hidden: !!notifyEmail },
  ].filter((s) => !s.hidden);
  const todo = steps.filter((s) => !s.done).length;

  return (
    <>
      <p className="mx-auto mt-4 max-w-md leading-relaxed text-white/60">
        {long
          ? "This search is taking longer than most. Your headhunter is still going, and good matches can take a while."
          : "First jobs usually arrive in 10 to 30 minutes. Your headhunter opens each one to check it's still open and fits you before sending it."}{" "}
        {notifyEmail ? "You can close this page. We'll email you when they're in." : "You can close this page and come back later."}
      </p>

      {todo > 0 && (
        <div className="mt-8 w-full max-w-md text-left">
          <p className="text-xs font-medium uppercase tracking-wider text-white/40">While you wait</p>
          <ul className="mt-3 divide-y divide-white/[0.06] rounded-2xl bg-white/[0.04]">
            {steps.map((s) => (
              <li key={s.title}>
                {s.done ? (
                  <div className="flex items-center gap-3 px-4 py-3.5 text-sm text-white/45">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-coral/20 text-rose">
                      <Check className="size-3.5" aria-hidden />
                    </span>
                    <span className="line-through decoration-white/25">{s.title}</span>
                    <span className="sr-only">(done)</span>
                  </div>
                ) : (
                  <Link href={s.href} className="group flex items-center gap-3 px-4 py-3.5 text-sm">
                    <span className="size-6 shrink-0 rounded-full border border-white/20" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-white">{s.title}</span>
                      <span className="block text-white/50">{s.body}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
