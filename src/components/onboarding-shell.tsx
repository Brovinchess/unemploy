import Link from "next/link";
import { Ninja, Wordmark } from "./brand";

const STEPS = ["Resume", "Preferences", "Activate"];

// Same frame as the landing page: wordmark left, one quiet action right, content centred.
export function OnboardingShell({
  step,
  wide = false,
  children,
}: {
  step?: number; // 0-based index into STEPS; omit for pre-setup screens
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-1 flex-col bg-night text-white">
      <header className="relative flex h-15 items-center justify-between px-[6%]">
        <Link href="/start" aria-label="Career Ninja">
          <Wordmark />
        </Link>
        {step !== undefined && (
          <ol className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 text-sm sm:flex" aria-label="Setup steps">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                {i > 0 && <span className="h-px w-6 bg-white/15" aria-hidden />}
                <span
                  className={i === step ? "text-white" : i < step ? "text-coral" : "text-white/40"}
                  aria-current={i === step ? "step" : undefined}
                >
                  {s}
                </span>
              </li>
            ))}
          </ol>
        )}
        <form action="/auth/logout" method="post">
          <button className="rounded-full bg-white/[0.08] px-4 py-2 text-sm text-white/85 transition-colors hover:bg-white/[0.14]">
            Sign out
          </button>
        </form>
      </header>
      {step !== undefined && (
        <div className="h-0.5 bg-white/[0.06]" role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
          <div className="h-full bg-coral transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      )}
      <main className={`mx-auto flex w-full ${wide ? "max-w-[40rem]" : "max-w-[34rem]"} flex-1 flex-col justify-center px-5 py-16`}>{children}</main>
    </div>
  );
}

export function StepHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-10 text-center">
      <Ninja className="mx-auto size-16" />
      <p className="mt-6 text-sm font-medium text-coral">{eyebrow}</p>
      <h1 className="font-display mt-2 text-3xl font-medium leading-tight tracking-[-0.01em] text-white sm:text-[2.5rem]">{title}</h1>
      {children && <div className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-white/55">{children}</div>}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-4 rounded-2xl bg-coral-soft px-4 py-3 text-center text-sm text-rose">
      {message}
    </p>
  );
}
