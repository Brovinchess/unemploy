"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FileText, MessageCircle, PackageCheck, PlugZap, Search } from "lucide-react";
import type { ActivityItem } from "@/lib/activity";

const POLL_MS = 15_000;

const ICONS = { brief: FileText, said: MessageCircle, work: Search, delivery: PackageCheck, test: PlugZap };

function when(iso: string) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return time;
  return `${d.toLocaleDateString(undefined, { weekday: "short" })} ${time}`;
}

// A live timeline of what the headhunter is doing. Polls while the tab is visible and
// refreshes the page when a new delivery lands, so new jobs appear without a reload.
export function ActivityFeed({ profileId, live, startOpen = false }: { profileId: string; live: boolean; startOpen?: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [partial, setPartial] = useState(false);
  const [open, setOpen] = useState(startOpen);
  const lastDelivery = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const r = await fetch(`/api/activity?profile=${profileId}`, { cache: "no-store" });
        if (r.ok && !stop) {
          const data = (await r.json()) as { items: ActivityItem[]; partial: boolean; lastDeliveryAt: string | null };
          setItems(data.items);
          setPartial(data.partial);
          if (lastDelivery.current !== undefined && data.lastDeliveryAt !== lastDelivery.current) router.refresh();
          lastDelivery.current = data.lastDeliveryAt;
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
  }, [profileId, live, router]);

  const shown = open ? items : items?.slice(0, 3);

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-surface p-5" aria-label="Headhunter activity">
      <div className="flex items-center justify-between">
        <h2 className="font-display flex items-center gap-2.5 text-sm font-medium text-white">
          {live && (
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-coral opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-coral" />
            </span>
          )}
          Activity
        </h2>
        {items && items.length > 3 && (
          <button className="flex items-center gap-1 text-xs text-white/50 hover:text-white" onClick={() => setOpen((o) => !o)}>
            {open ? "Show less" : `Show all ${items.length}`}
            <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
          </button>
        )}
      </div>

      {items === null ? (
        <div className="mt-4 space-y-3" aria-hidden>
          {[70, 55, 62].map((w) => (
            <div key={w} className="h-3 animate-pulse rounded-full bg-white/[0.06]" style={{ width: `${w}%` }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-white/50">Nothing yet. Updates show up here as your headhunter works.</p>
      ) : (
        <ol className="mt-4 space-y-4" aria-live="polite">
          {shown!.map((it) => {
            const Icon = ICONS[it.kind];
            return (
              <li key={it.id} className="flex gap-3">
                <span
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
                    it.kind === "delivery" ? "bg-coral text-white" : "bg-white/[0.07] text-white/65"
                  }`}
                >
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-white">{it.title}</span>
                    <time dateTime={it.at} className="shrink-0 text-xs text-white/40" suppressHydrationWarning>
                      {when(it.at)}
                    </time>
                  </p>
                  {it.detail && (
                    <p className={`mt-0.5 text-sm leading-relaxed text-white/55 ${it.kind === "said" ? "line-clamp-3 italic" : ""}`}>
                      {it.kind === "said" ? `“${it.detail}”` : it.detail}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {partial && <p className="mt-4 text-xs text-white/40">Some updates from Hello Minds couldn&rsquo;t be loaded just now.</p>}
    </section>
  );
}
