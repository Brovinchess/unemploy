import Link from "next/link";
import { LogOut, Plus } from "lucide-react";
import type { Profile } from "@/db/schema";
import { estimateDailyCost } from "@/lib/preferences";
import { Ninja, Wordmark } from "./brand";

type Tab = "shortlist" | "tracker" | "settings";

const TABS: { id: Tab; label: string; href: string }[] = [
  { id: "shortlist", label: "Shortlist", href: "/app" },
  { id: "tracker", label: "Tracker", href: "/app/tracker" },
  { id: "settings", label: "Settings", href: "/app/settings" },
];

export function AppHeader({
  tab,
  profiles,
  current,
  balance,
}: {
  tab: Tab;
  profiles: Profile[];
  current?: Profile;
  balance?: number | null;
}) {
  const perDay = current?.preferences ? estimateDailyCost(current.preferences.jobsPerDay).cognition : null;
  const daysLeft = balance != null && perDay ? Math.floor(balance / perDay) : null;
  const low = balance != null && (balance <= 0 || (daysLeft != null && daysLeft <= 3));

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-night/90 backdrop-blur">
      <div className="flex h-15 items-center gap-6 px-[6%]">
        <Link href="/app" className="flex items-center gap-2" aria-label="Career Ninja">
          <Ninja className="size-8" />
          <Wordmark className="hidden sm:inline" />
        </Link>
        <nav className="flex h-full items-stretch gap-1" aria-label="Main">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={current && t.id !== "tracker" ? `${t.href}?profile=${current.id}` : t.href}
              className={`font-display flex items-center border-b-2 px-2.5 text-sm font-semibold sm:px-3 ${
                tab === t.id ? "border-coral text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
              aria-current={tab === t.id ? "page" : undefined}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {current && balance !== undefined && (
            <Link
              href={`/app/settings?profile=${current.id}`}
              className={`hidden rounded-full px-3 py-1.5 text-sm sm:block ${low ? "bg-coral-soft text-rose" : "bg-white/[0.06] text-white/70 hover:text-white"}`}
              title="Cognition left for this headhunter"
            >
              {balance == null
                ? "Balance unavailable"
                : `${Math.round(balance)} cognition${daysLeft != null ? ` · about ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left` : ""}`}
            </Link>
          )}
          <form action="/auth/logout" method="post">
            <button className="flex size-9 items-center justify-center rounded-full text-white/55 hover:bg-white/[0.08] hover:text-white" title="Sign out">
              <LogOut className="size-4" aria-hidden />
              <span className="sr-only">Sign out</span>
            </button>
          </form>
        </div>
      </div>

      {current && tab !== "tracker" && (
        <div className="flex items-center gap-2 overflow-x-auto px-[6%] pb-3" role="tablist" aria-label="Headhunters">
          {profiles.map((p) => (
            <Link
              key={p.id}
              role="tab"
              aria-selected={p.id === current.id}
              href={`?profile=${p.id}`}
              className="chip min-h-8 shrink-0 px-3.5 text-sm"
            >
              {p.label}
              {p.status === "paused" && <span className="text-xs opacity-70">· paused</span>}
            </Link>
          ))}
          <Link href="/profiles/new" className="chip min-h-8 shrink-0 px-3 text-sm text-muted" title="Add a headhunter">
            <Plus className="size-4" aria-hidden /> <span className="sr-only sm:not-sr-only">Add</span>
          </Link>
        </div>
      )}
    </header>
  );
}
