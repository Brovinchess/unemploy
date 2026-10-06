"use client";

import { useEffect, useState } from "react";
import { ChevronDown, FileText, MessageCircle, PackageCheck, PlugZap, Search } from "lucide-react";
import type { ActivityItem, ActivityStats } from "@/lib/activity";

const POLL_MS = 15_000;

const ICONS = { brief: FileText, said: MessageCircle, work: Search, delivery: PackageCheck, test: PlugZap };

type Activity = { items: ActivityItem[]; stats: ActivityStats; partial: boolean };

// Polls the headhunter's activity while the tab is visible. (Page refreshes when jobs land
// are LiveProvider's job.)
export function useActivity(profileId: string, live: boolean) {
  const [data, setData] = useState<Activity | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const r = await fetch(`/api/activity?profile=${profileId}`, { cache: "no-store" });
        if (r.ok && !stop) {
          setData((await r.json()) as Activity);
        }
      } catch {
        // Offline for a moment; try again on the next tick.
      }
      if (!stop && live) timer = setTimeout(tick, POLL_MS);
    };
    const tick = () => (document.visibilityState === "visible" ? load() : (timer = setTimeout(tick, POLL_MS)));
    load();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [profileId, live]);

  return data;
}

function when(iso: string) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString(undefined, { weekday: "short" })} ${time}`;
}

export function LiveDot() {
  return (
    <span className="relative flex size-2">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-coral opacity-60" />
      <span className="relative inline-flex size-2 rounded-full bg-coral" />
    </span>
  );
}

// `compact`: one short line per update ("Read a file", "Sent you an update"), no message text.
export function ActivityList({ items, limit, compact = false }: { items: ActivityItem[] | null; limit?: number; compact?: boolean }) {
  if (items === null) {
    return (
      <div className="space-y-4" aria-hidden>
        {[70, 55, 62].map((w) => (
          <div key={w} className="h-3 animate-pulse rounded-full bg-white/[0.06]" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  }
  if (items.length === 0) return <p className="text-sm text-white/50">Nothing yet. Updates show up here as your headhunter works.</p>;
  return (
    <ol className={`relative ${compact ? "space-y-3" : "space-y-5"}`} aria-live="polite">
      <span className="absolute bottom-2 left-[13px] top-2 w-px bg-white/[0.07]" aria-hidden />
      {items.slice(0, limit).map((it) => {
        const Icon = ICONS[it.kind];
        return (
          <li key={it.id} className="relative flex gap-3.5">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-surface ${
                it.kind === "delivery" ? "bg-coral text-white" : "bg-night-3 text-white/70"
              }`}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-white">{compact && it.kind === "said" ? "Sent you an update" : it.title}</span>
                <time dateTime={it.at} className="shrink-0 text-xs text-white/40" suppressHydrationWarning>
                  {when(it.at)}
                </time>
              </p>
              {it.detail && !compact && (
                <p className={`mt-1 text-sm leading-relaxed text-white/55 ${it.kind === "said" ? "line-clamp-4" : ""}`}>
                  {it.kind === "said" ? `“${it.detail}”` : it.detail}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// Compact feed for the top of the job list: latest item, expandable.
export function ActivityFeed({ profileId, live }: { profileId: string; live: boolean }) {
  const data = useActivity(profileId, live);
  const [open, setOpen] = useState(false);
  const items = data?.items ?? null;

  return (
    <section className="rounded-2xl bg-surface p-4" aria-label="Headhunter activity">
      <button className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="font-display flex items-center gap-2.5 text-sm font-medium text-white">
          {live && <LiveDot />} Activity
        </span>
        <span className="flex min-w-0 items-center gap-2 text-xs text-white/45">
          {!open && items?.[0] && <span className="truncate">{items[0].title}</span>}
          <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </span>
      </button>
      {open && (
        <div className="mt-4">
          <ActivityList items={items} />
        </div>
      )}
      {open && data?.partial && <p className="mt-4 text-xs text-white/40">Some updates from Hello Minds couldn&rsquo;t be loaded just now.</p>}
    </section>
  );
}

// Full activity timeline for a headhunter's page.
export function ActivityPanel({ profileId, live }: { profileId: string; live: boolean }) {
  const data = useActivity(profileId, live);
  return (
    <section className="rounded-3xl bg-surface p-6" aria-label="Headhunter activity">
      <h2 className="font-display flex items-center gap-2.5 text-lg font-medium text-white">
        {live && <LiveDot />} Activity
      </h2>
      <p className="mt-1 text-sm text-white/50">{live ? "Live while it searches." : "What it did in recent searches."}</p>
      <div className="mt-6">
        <ActivityList items={data?.items ?? null} />
      </div>
      {data?.partial && <p className="mt-6 text-xs text-white/40">Some updates from Hello Minds couldn&rsquo;t be loaded just now.</p>}
    </section>
  );
}
