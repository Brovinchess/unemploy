import Link from "next/link";
import { Ninja } from "./brand";
import { SearchingPulse } from "./searching-status";

// The Jobs page while the very first search runs and nothing has landed yet: Mochi thinking
// in front of a radar that keeps sweeping, so the page clearly looks busy. No time estimate,
// just what happens next.
export function SearchingScene({ profileId, startedAt, notifyEmail }: { profileId: string; startedAt: string | null; notifyEmail: string | null }) {
  return (
    <section className="rise rise-1 flex flex-col items-center overflow-hidden rounded-3xl bg-surface px-8 py-14 text-center">
      <div className="relative flex size-56 items-center justify-center">
        <Radar live />
        <Ninja mood="thinking" className="relative size-28 bob" />
      </div>
      <h2 className="font-display mt-4 text-3xl font-medium tracking-tight text-white">Your headhunter is out searching</h2>
      <SearchingPulse profileId={profileId} startedAt={startedAt} />
      <p className="mx-auto mt-3 max-w-sm leading-relaxed text-white/55">
        It takes time for your headhunter to look for jobs.
        {notifyEmail ? <> You&rsquo;ll get an email when it finds some.</> : <> Check back in a while.</>}
      </p>
      <Link href="/app/you#application" className="mt-7 text-sm text-white/50 underline underline-offset-4 hover:text-white">
        Meanwhile, add your details so applications are ready to send
      </Link>
    </section>
  );
}

// Concentric rings, a sweeping beam and a few blips that light up as the beam passes.
export function Radar({ live = true, className = "absolute inset-0 size-full" }: { live?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <defs>
        <linearGradient id="radar-beam" gradientUnits="userSpaceOnUse" x1="100" y1="100" x2="100" y2="10">
          <stop offset="0" stopColor="var(--coral)" stopOpacity=".55" />
          <stop offset="1" stopColor="var(--coral)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[96, 72, 48, 24].map((r) => (
        <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#fff" strokeOpacity=".08" strokeWidth="1" />
      ))}
      <line x1="4" y1="100" x2="196" y2="100" stroke="#fff" strokeOpacity=".05" />
      <line x1="100" y1="4" x2="100" y2="196" stroke="#fff" strokeOpacity=".05" />
      {/* the beam: a wedge that spins around the centre */}
      {live && (
      <g className="radar-sweep" style={{ transformOrigin: "100px 100px" }}>
        <path d="M100 100 L100 4 A96 96 0 0 1 157 23 Z" fill="url(#radar-beam)" />
        <line x1="100" y1="100" x2="100" y2="4" stroke="var(--coral)" strokeOpacity=".8" strokeWidth="1.5" />
      </g>
      )}
      {/* blips: each lights up when the beam reaches it */}
      {[
        [142, 48, 0.4],
        [160, 128, 1.6],
        [56, 152, 3.3],
        [40, 70, 5.2],
      ].map(([x, y, d]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3.5" fill="var(--coral)" className={live ? "radar-blip" : ""} opacity={live ? undefined : 0.25} style={{ animationDelay: `${d}s` }} />
      ))}
      {live && <circle cx="100" cy="100" r="98" fill="none" stroke="var(--coral)" strokeOpacity=".25" className="radar-pulse" style={{ transformOrigin: "100px 100px" }} />}
    </svg>
  );
}
