"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="font-display mt-3 text-2xl font-bold text-ink">We couldn&rsquo;t load this page</h1>
      <p className="mt-3 text-muted">
        This is usually temporary. Try again, and if it keeps happening, sign out and back in.
      </p>
      <div className="mt-8 flex gap-3">
        <button className="btn btn-primary" onClick={reset}>
          Try again
        </button>
        <Link href="/start" className="btn btn-ghost">
          Go home
        </Link>
      </div>
    </main>
  );
}
