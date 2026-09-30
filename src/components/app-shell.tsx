import Link from "next/link";
import { and, count, eq, inArray } from "drizzle-orm";
import { ExternalLink, KanbanSquare, ListChecks, LogOut, Plus, Settings } from "lucide-react";
import { db, schema } from "@/db";
import type { Profile, User } from "@/db/schema";
import { mindsConfig } from "@/lib/minds/config";
import { estimateDailyCost } from "@/lib/preferences";
import { Ninja, Wordmark } from "./brand";

type Tab = "shortlist" | "tracker" | "settings";

// The signed-in frame: a sidebar with the user's headhunters, navigation, cognition and
// account on large screens; a compact top bar on small ones.
export async function AppShell({
  tab,
  user,
  profiles,
  current,
  balance,
  children,
}: {
  tab: Tab;
  user: User;
  profiles: Profile[];
  current: Profile;
  balance: number | null;
  children: React.ReactNode;
}) {
  const newCounts = await db
    .select({ profileId: schema.jobs.profileId, n: count() })
    .from(schema.jobs)
    .where(and(inArray(schema.jobs.profileId, profiles.map((p) => p.id)), eq(schema.jobs.status, "new")))
    .groupBy(schema.jobs.profileId);
  const fresh = new Map(newCounts.map((r) => [r.profileId, r.n]));

  const q = `?profile=${current.id}`;
  const nav = [
    { id: "shortlist" as const, label: "Shortlist", href: `/app${q}`, icon: ListChecks, badge: fresh.get(current.id) },
    { id: "tracker" as const, label: "Tracker", href: `/app/tracker${q}`, icon: KanbanSquare },
    { id: "settings" as const, label: "Settings", href: `/app/settings${q}`, icon: Settings },
  ];

  const perDay = current.preferences ? estimateDailyCost(current.preferences.jobsPerDay).cognition : null;
  const daysLeft = balance != null && perDay ? Math.max(0, Math.floor(balance / perDay)) : null;
  const low = balance != null && (balance <= 0 || (daysLeft != null && daysLeft <= 3));
  const fill = daysLeft == null ? 0 : Math.min(100, (daysLeft / 14) * 100);

  return (
    <div className="flex min-h-svh flex-1 bg-night text-white">
      <aside className="sticky top-0 hidden h-svh w-[264px] shrink-0 flex-col border-r border-white/[0.06] bg-[#10161c] px-4 py-5 lg:flex">
        <Link href={`/app${q}`} className="flex items-center gap-2.5 px-2" aria-label="Career Ninja">
          <Ninja className="size-8" />
          <Wordmark />
        </Link>

        <nav className="mt-8 space-y-0.5" aria-label="Main">
          {nav.map((n) => (
            <Link
              key={n.id}
              href={n.href}
              aria-current={tab === n.id ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                tab === n.id ? "bg-white/[0.07] text-white" : "text-white/60 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <n.icon className="size-4" aria-hidden />
              <span className="flex-1">{n.label}</span>
              {!!n.badge && <span className="rounded-full bg-coral px-2 py-0.5 text-xs font-medium text-white">{n.badge}</span>}
            </Link>
          ))}
        </nav>

        <p className="mt-8 px-3 text-xs font-medium uppercase tracking-wider text-white/35">Headhunters</p>
        <ul className="mt-2 space-y-0.5">
          {profiles.map((p) => {
            const active = p.id === current.id;
            return (
              <li key={p.id}>
                <Link
                  href={`/app${tab === "shortlist" ? "" : `/${tab}`}?profile=${p.id}`}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 ${active ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"}`}
                >
                  <span className="relative">
                    <Ninja className="size-7" />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-[#10161c] ${
                        p.status === "paused" ? "bg-white/30" : "bg-coral"
                      }`}
                      title={p.status === "paused" ? "Paused" : "Searching"}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm ${active ? "text-white" : "text-white/70"}`}>{p.label}</span>
                    <span className="block truncate font-mono text-[11px] text-white/35">{p.mindName}</span>
                  </span>
                  {!!fresh.get(p.id) && !active && <span className="size-2 rounded-full bg-coral" aria-label="New jobs" />}
                </Link>
              </li>
            );
          })}
          <li>
            <Link href="/profiles/new" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/50 hover:bg-white/[0.04] hover:text-white">
              <span className="flex size-7 items-center justify-center rounded-full border border-dashed border-white/20">
                <Plus className="size-3.5" aria-hidden />
              </span>
              Add headhunter
            </Link>
          </li>
        </ul>

        <div className="mt-auto space-y-3">
          <div className="rounded-2xl bg-white/[0.04] p-4">
            <p className="flex items-baseline justify-between text-sm">
              <span className="text-white/60">Cognition</span>
              <span className={low ? "text-rose" : "text-white"}>{balance == null ? "–" : Math.round(balance)}</span>
            </p>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
              <div className={`h-full rounded-full ${low ? "bg-rose" : "bg-coral"}`} style={{ width: `${fill}%` }} />
            </div>
            <p className="mt-2 text-xs text-white/45">
              {balance == null ? "Balance unavailable" : daysLeft == null ? "" : `About ${daysLeft} ${daysLeft === 1 ? "day" : "days"} of searching left`}
            </p>
            <a
              href={mindsConfig.topUpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-3 flex h-9 items-center justify-center gap-1.5 rounded-full text-sm ${
                low ? "bg-coral text-white hover:bg-rose" : "bg-white/[0.07] text-white/80 hover:bg-white/[0.12]"
              }`}
            >
              Top up <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>
          <div className="flex items-center gap-3 px-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-white/[0.08] text-xs font-semibold uppercase">
              {user.username?.[0] ?? "?"}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-white/70">{user.username}</span>
            <form action="/auth/logout" method="post">
              <button className="flex size-8 items-center justify-center rounded-full text-white/50 hover:bg-white/[0.08] hover:text-white" title="Sign out">
                <LogOut className="size-4" aria-hidden />
                <span className="sr-only">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Small screens: logo, tabs, headhunter switcher */}
        <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-night/90 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center gap-4 px-4">
            <Link href={`/app${q}`} aria-label="Career Ninja">
              <Ninja className="size-8" />
            </Link>
            <nav className="flex flex-1 gap-1" aria-label="Main">
              {nav.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  className={`rounded-full px-3 py-1.5 text-sm ${tab === n.id ? "bg-white/[0.08] text-white" : "text-white/55"}`}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <span className={`text-xs ${low ? "text-rose" : "text-white/50"}`}>{balance == null ? "" : `${Math.round(balance)} cog`}</span>
          </div>
          {profiles.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 pb-3">
              {profiles.map((p) => (
                <Link key={p.id} href={`?profile=${p.id}`} aria-selected={p.id === current.id} className="chip min-h-8 shrink-0 px-3.5 text-sm">
                  {p.label}
                </Link>
              ))}
            </div>
          )}
        </header>
        {children}
      </div>
    </div>
  );
}
