"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Ninja } from "./brand";
import { SwipeDeck, type CardJob } from "./swipe-deck";

// New cards. The first time (nothing kept yet) the deck is the whole page. Once there's a
// list underneath, new cards sit in a short strip and the deck opens over the page, so
// reviewing is a focused moment and the list keeps its place.
export function NewJobs({
  jobs,
  after,
  inline,
}: {
  jobs: CardJob[];
  after?: React.ReactNode;
  inline: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const close = () => {
    setOpen(false);
    router.refresh(); // the list below picks up what was decided
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (inline) return <SwipeDeck jobs={jobs} after={after} />;

  const n = jobs.length;
  return (
    <>
      <section className="flex flex-col gap-4 rounded-3xl border border-white/[0.06] bg-gradient-to-r from-coral/[0.14] to-surface px-5 py-4 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Ninja mood="surprised" className="size-14 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-medium text-white">
              {n} new {n === 1 ? "job" : "jobs"} to look at
            </p>
            <p className="text-sm text-white/55">
              Reveal each one, then swipe right to apply or left to pass.
            </p>
          </div>
        </div>
        <button
          className="btn btn-accent h-10 w-full shrink-0 justify-center sm:w-auto"
          onClick={() => setOpen(true)}
        >
          Review {n === 1 ? "it" : "them"}
        </button>
      </section>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-night/95 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="New jobs"
          >
            <button
              className="fixed right-5 top-5 z-10 flex size-10 items-center justify-center rounded-full bg-white/[0.06] text-white/60 hover:bg-white/[0.12] hover:text-white"
              onClick={close}
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
            <div className="mx-auto w-full max-w-[920px] px-5 pb-16 pt-14">
              <SwipeDeck jobs={jobs} after={after} />
              <p className="mt-8 text-center">
                <button
                  className="text-sm text-white/45 underline underline-offset-4 hover:text-white"
                  onClick={close}
                >
                  Back to your jobs
                </button>
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
