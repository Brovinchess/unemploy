import { Logo } from "./logo";

const STEPS = ["Launch", "Activate", "Resume", "Preferences"];

export function OnboardingShell({
  step,
  children,
}: {
  step?: number; // 0-based index into STEPS; omit for pre-setup screens
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col bg-surface">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4 sm:px-6">
          <Logo href="/start" />
          {step !== undefined && (
            <p className="text-sm text-muted">
              Step <span className="font-semibold text-ink">{step + 1}</span> of {STEPS.length} · {STEPS[step]}
            </p>
          )}
        </div>
        {step !== undefined && (
          <div
            className="h-1 bg-mist-soft"
            role="progressbar"
            aria-label="Setup progress"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={step + 1}
          >
            <div className="h-full bg-coral transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6 sm:py-16">{children}</main>
    </div>
  );
}

export function StepHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-10">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="font-display mt-3 text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">{title}</h1>
      {children && <div className="mt-4 max-w-xl text-lg leading-relaxed text-muted">{children}</div>}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-4 rounded-xl bg-coral-soft px-4 py-3 text-sm text-rose">
      {message}
    </p>
  );
}
