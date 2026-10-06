import Link from "next/link";
import { and, count, eq, inArray } from "drizzle-orm";
import { ExternalLink, ListChecks, LogOut, Plus, Settings, UserRound } from "lucide-react";
import { db, schema } from "@/db";
import type { Profile, User } from "@/db/schema";
import { mindsConfig } from "@/lib/minds/config";
import { costModel } from "@/lib/cost";
import { estimateSearchCost } from "@/lib/preferences";
import { questionCounts } from "@/lib/personal";
import { isSearching } from "@/lib/search";
import { Ninja, Wordmark } from "./brand";
import { LiveBadge, LiveCognition, LiveCognitionShort, LiveProvider, type Live } from "./live";
import { TitleBadge } from "./title-badge";

type Tab = "jobs" | "you" | "settings" | "headhunter";

// The signed-in frame: a sidebar with the user's headhunters, navigation, cognition and
// account on large screens; a compact top bar on small ones.
export async function AppShell({
  tab,
  user,
  profiles,
  unfinished = [],
  current,
  balance,
  children,
}: {
  tab: Tab;
  user: User;
  profiles: Profile[];
  unfinished?: Profile[];
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

  const allNew = [...fresh.values()].reduce((a, n) => a + n, 0);
  const { forYou, asked, new: waiting } = await questionCounts(user.id);
  const [{ n: toApply }] = await db
    .select({ n: count() })
    .from(schema.jobs)
    .where(and(inArray(schema.jobs.profileId, profiles.map((p) => p.id)), eq(schema.jobs.status, "saved")));
  // Two places to be: the jobs, and everything about you. Setup lives behind the gear.
  const nav = [
    { id: "jobs" as const, label: "Jobs", href: "/app", icon: ListChecks, badge: "new" as const },
    { id: "you" as const, label: "You", href: "/app/you", icon: UserRound, badge: "answers" as const },
  ];

  const perSearchJobs = current.preferences?.jobsPerDay ?? 5;
  const { perJob } = await costModel(current.id);
  const perSearch = estimateSearchCost(perSearchJobs, perJob).cognition;
  const low = balance != null && balance < perSearch;
  const searching = isSearching(current);
  const initial: Live = {
    at: new Date().toISOString(),
    profile: {
      id: current.id,
      searching,
      startedAt: searching ? (current.searchStartedAt?.toISOString() ?? null) : null,
      lastDeliveryAt: current.lastDeliveryAt?.toISOString() ?? null,
      jobsFound: 0,
      balance,
    },
    newJobs: allNew,
    toApply,
    answers: { forYou, asked, waiting, balance: null },
  };

  return (
    <LiveProvider key={current.id} initial={initial}>
    <div className="flex min-h-svh flex-1 bg-night text-white">
      <TitleBadge count={allNew} />
      <aside className="sticky top-0 hidden h-svh w-[264px] shrink-0 flex-col border-r border-white/[0.06] bg-[#10161c] px-4 py-5 lg:flex">
        <Link href="/app" className="flex items-center gap-2.5 px-2" aria-label="Career Ninja">
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
              {n.badge && <LiveBadge kind={n.badge} />}
            </Link>
          ))}
        </nav>

        <p className="mt-8 px-3 text-xs font-medium uppercase tracking-wider text-white/35">Headhunters</p>
        <ul className="mt-2 space-y-0.5">
          {profiles.map((p) => {
            const active = tab === "headhunter" && p.id === current.id;
            return (
              <li key={p.id}>
                <Link
                  href={`/app/headhunters/${p.id}`}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 ${active ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"}`}
                >
                  <span className="relative">
                    <Ninja mood={isSearching(p) ? "searching" : p.status === "paused" ? "sleeping" : "happy"} className="size-7" />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-[#10161c] ${
                        isSearching(p) ? "animate-pulse bg-coral" : p.status === "paused" ? "bg-white/20" : "bg-mist"
                      }`}
                      title={isSearching(p) ? "Searching" : p.status === "paused" ? "Paused" : "Ready"}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm ${active ? "text-white" : "text-white/70"}`}>{p.label}</span>
                    <span className="block truncate font-mono text-[11px] text-white/35">{p.mindName}</span>
                  </span>
                  {!!fresh.get(p.id) && <span className="text-xs text-coral">{fresh.get(p.id)} new</span>}
                </Link>
              </li>
            );
          })}
          {unfinished.map((p) => (
            <li key={p.id}>
              <Link href={`/profiles/${p.id}/setup`} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/[0.04]">
                <Ninja className="size-7 opacity-40" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-white/55">{p.label}</span>
                  <span className="block text-[11px] text-coral">Finish setup</span>
                </span>
              </Link>
            </li>
          ))}
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
            <LiveCognition perSearchJobs={perSearchJobs} perJob={perJob} />
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
            <Link
              href="/app/settings"
              aria-current={tab === "settings" ? "page" : undefined}
              className={`flex size-8 items-center justify-center rounded-full hover:bg-white/[0.08] hover:text-white ${tab === "settings" ? "bg-white/[0.08] text-white" : "text-white/50"}`}
              title="Settings"
            >
              <Settings className="size-4" aria-hidden />
              <span className="sr-only">Settings</span>
            </Link>
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
            <Link href="/app" aria-label="Career Ninja">
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
            <span className={`text-xs ${low ? "text-rose" : "text-white/50"}`}>
              <LiveCognitionShort />
            </span>
            <Link href="/app/settings" className={`flex size-8 items-center justify-center rounded-full ${tab === "settings" ? "text-white" : "text-white/50"}`} title="Settings">
              <Settings className="size-4" aria-hidden />
              <span className="sr-only">Settings</span>
            </Link>
          </div>
          {profiles.length > 0 && (
            <div className="flex gap-2 overflow-x-auto px-4 pb-3">
              {profiles.map((p) => (
                <Link key={p.id} href={`/app/headhunters/${p.id}`} aria-selected={tab === "headhunter" && p.id === current.id} className="chip min-h-8 shrink-0 px-3.5 text-sm">
                  {p.label}
                </Link>
              ))}
            </div>
          )}
        </header>
        {children}
      </div>
    </div>
    </LiveProvider>
  );
}
