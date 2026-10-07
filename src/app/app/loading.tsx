// Shown instantly on navigation while the page's data loads: the same frame as the app,
// with placeholders where the content goes, so switching tabs never looks frozen.
export default function Loading() {
  return (
    <div className="flex min-h-svh flex-1 bg-night text-white" aria-busy>
      <aside className="hidden h-svh w-[264px] shrink-0 border-r border-white/[0.06] bg-[#10161c] px-4 py-5 lg:block">
        <div className="mt-1 h-8 w-36 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="mt-10 space-y-3">
          <div className="h-9 w-full animate-pulse rounded-xl bg-white/[0.05]" />
          <div className="h-9 w-full animate-pulse rounded-xl bg-white/[0.04]" />
        </div>
      </aside>
      <main className="w-full flex-1 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="h-4 w-32 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="mt-3 h-9 w-48 animate-pulse rounded-full bg-white/[0.08]" />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="h-48 animate-pulse rounded-3xl bg-surface" />
          <div className="h-48 animate-pulse rounded-3xl bg-surface" />
        </div>
      </main>
    </div>
  );
}
