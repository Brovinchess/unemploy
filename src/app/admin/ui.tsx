import Link from "next/link";
import { ChevronDown, ChevronRight, ChevronUp, ChevronsUpDown } from "lucide-react";
import { Ninja, type Mood } from "@/components/brand";
import type { Dir, Query } from "@/lib/admin";
import { withParams } from "@/lib/admin";

// Small building blocks for the admin pages. Server-safe, no state. The look lives in the
// `.admin` block of globals.css: panel colours, hairlines, the rise/grow/widen entrances.

// ---- page frame -------------------------------------------------------------------------

// Eyebrow, title, one-line description, and the control row (window picker, filters) on
// the right. Sticks to the top of the content area with a blurred strip behind it.
export function PageHead({ section, title, description, controls, children }: { section: string; title: string; description?: React.ReactNode; controls?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="admin-head sticky top-0 z-20 -mx-5 border-b border-white/[0.06] px-5 pb-4 pt-5 lg:-mx-8 lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-coral">{section}</p>
          <h1 className="font-display mt-1 text-[28px] font-medium leading-tight text-white">{title}</h1>
          {description && <p className="admin-text-2 mt-1 text-sm">{description}</p>}
        </div>
        {controls && <div className="flex flex-wrap items-center gap-2 lg:justify-end">{controls}</div>}
      </div>
      {children}
    </header>
  );
}

// A section heading between blocks of a page.
export function SectionTitle({ title, hint, className = "mt-10" }: { title: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <h2 className="font-display text-lg font-medium text-white">{title}</h2>
      {hint && <p className="admin-text-2 mt-0.5 text-sm">{hint}</p>}
    </div>
  );
}

// The small uppercase label that groups tiles ("All time", "Last 7 days").
export function GroupLabel({ children, className = "mt-8" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`admin-text-3 text-[11px] font-semibold uppercase tracking-wide ${className}`}>{children}</h2>;
}

export function Card({ title, hint, children, className = "" }: { title?: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`admin-panel rounded-2xl p-5 ${className}`}>
      {title && <h2 className="font-display text-lg font-medium text-white">{title}</h2>}
      {hint && <p className="admin-text-2 mt-0.5 text-sm">{hint}</p>}
      <div className={title || hint ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

// Breadcrumb line above a detail page: every item but the last is a link.
export function Breadcrumb({ items }: { items: [string, string?][] }) {
  return (
    <nav aria-label="Breadcrumb" className="admin-text-3 flex flex-wrap items-center gap-1 text-sm">
      {items.map(([label, href], i) => (
        <span key={`${label}-${i}`} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="size-3.5 opacity-60" aria-hidden />}
          {href ? <Link href={href} className="hover:text-white">{label}</Link> : <span className="text-white">{label}</span>}
        </span>
      ))}
    </nav>
  );
}

// Detail-page hero: Mochi in the mood that fits, the title, a line under it, and a badge.
export function Hero({ mood, title, subtitle, badge, children }: { mood: Mood; title: React.ReactNode; subtitle?: React.ReactNode; badge?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="admin-panel rise mt-4 flex flex-col gap-5 rounded-2xl p-5 sm:flex-row sm:items-center">
      <Ninja mood={mood} className="bob-sm size-20 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-xl font-medium text-white">{title}</h2>
          {badge}
        </div>
        {subtitle && <p className="admin-text-2 mt-1 text-sm">{subtitle}</p>}
        {children}
      </div>
    </section>
  );
}

// ---- tiles and lists --------------------------------------------------------------------

// A grid of KPI tiles: two per row on phones, `cols` on desktop, rising in one after another.
export function Tiles({ cols = 6, children, className = "" }: { cols?: 4 | 5 | 6 | 7 | 8; children: React.ReactNode; className?: string }) {
  const lg = { 4: "lg:grid-cols-4", 5: "lg:grid-cols-5", 6: "lg:grid-cols-6", 7: "lg:grid-cols-7", 8: "lg:grid-cols-8" }[cols];
  return <div className={`admin-tiles grid grid-cols-2 gap-4 sm:grid-cols-3 ${lg} ${className}`}>{children}</div>;
}

export function Stat({ label, value, hint, href }: { label: string; value: string | number; hint?: string; href?: string }) {
  const body = (
    <>
      <p className="admin-text-3 text-[11px] font-semibold uppercase tracking-wide">{label}</p>
      <p className="font-display mt-2 text-2xl font-medium tabular-nums leading-none text-white">{value}</p>
      {hint && <p className="admin-text-3 mt-2 truncate text-xs" title={hint}>{hint}</p>}
    </>
  );
  const cls = "admin-panel block rounded-2xl p-5";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-white/[0.14] hover:bg-[var(--admin-panel-2)]`}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Counts({ title, rows, total }: { title: string; rows: [string, number][]; total: number }) {
  return (
    <Card title={title}>
      {rows.length === 0 && <Empty mood="thinking">Nothing in this window.</Empty>}
      <ul className="space-y-2 text-sm">
        {rows.map(([k, n]) => {
          const share = Math.round((n / Math.max(1, total)) * 100);
          return (
            <li key={k}>
              <div className="flex items-center justify-between gap-4">
                <span className="admin-text-2 truncate" title={k}>{k}</span>
                <span className="shrink-0 tabular-nums text-white">
                  {n} <span className="admin-text-3">· {share}%</span>
                </span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-white/[0.05]">
                <div className="admin-widen h-1 rounded-full bg-white/25" style={{ width: `${Math.max(1, share)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// Mochi and one plain sentence, centred. Used wherever a list or table has nothing in it.
export function Empty({ mood = "thinking", children }: { mood?: Mood; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
      <Ninja mood={mood} className="bob-sm size-14" />
      <p className="admin-text-2 text-sm">{children}</p>
    </div>
  );
}

// ---- badges --------------------------------------------------------------------------------

export type Tone = "slate" | "teal" | "blue" | "amber" | "green" | "rose" | "muted";
const TONE: Record<Tone, string> = {
  slate: "bg-slate-400/15 text-slate-300",
  teal: "bg-teal-400/15 text-teal-300",
  blue: "bg-sky-400/15 text-sky-300",
  amber: "bg-amber-400/15 text-amber-300",
  green: "bg-emerald-400/15 text-emerald-300",
  rose: "bg-rose-400/15 text-rose-300",
  muted: "bg-white/[0.06] text-white/45",
};
export function Badge({ tone = "slate", children, title }: { tone?: Tone; children: React.ReactNode; title?: string }) {
  return <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONE[tone]}`}>{children}</span>;
}

// Job stages, as the Badge component colours them.
const STAGE_TONE: Record<string, Tone> = { new: "slate", saved: "slate", applied: "teal", heard_back: "blue", interview: "amber", offer: "green", rejected: "rose", skipped: "muted", expired: "muted" };
export const stageTone = (status: string): Tone => STAGE_TONE[status] ?? "slate";
// Why a search ended: finished green, stopped amber, timeout rose; still open is teal.
export const endTone = (reason: string | null | undefined, open: boolean): Tone => (open ? "teal" : reason === "finished" ? "green" : reason === "stopped" ? "amber" : reason === "timeout" || reason === "no_cognition" ? "rose" : "slate");
// Headhunter status: hunting green, paused amber, the needs_* and draft steps slate.
export const hhTone = (status: string): Tone => (status === "hunting" ? "green" : status === "paused" ? "amber" : "slate");

// Long text stops at two lines; hover for all of it.
export function Clamp({ text, className = "max-w-md" }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;
  return <span className={`admin-clamp ${className}`} title={text}>{text}</span>;
}

// ---- tables --------------------------------------------------------------------------------

// Tables scroll inside their border; the header stays put while the body scrolls. Headers
// may be plain text or SortLinks. Empty tables show Mochi instead of a bare header row.
export function Table({ head, rows, empty = "Nothing to show.", emptyMood = "thinking" }: { head: React.ReactNode[]; rows: React.ReactNode[][]; empty?: string; emptyMood?: Mood }) {
  if (!rows.length) {
    return (
      <div className="admin-panel rounded-2xl">
        <Empty mood={emptyMood}>{empty}</Empty>
      </div>
    );
  }
  return (
    <div className="admin-table max-h-[75vh] overflow-auto rounded-2xl border border-white/[0.06]">
      <table className="w-full text-left text-sm">
        <thead className="admin-text-2 text-[11px] uppercase tracking-wide">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap border-b border-white/[0.06] px-3 py-2.5 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="align-top transition-colors">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 tabular-nums text-white/80">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Cap({ shown, total }: { shown: number; total: number }) {
  if (total <= shown) return null;
  return <p className="admin-text-3 mt-2 text-xs">Showing the first {shown} of {total} rows. Narrow the window or filters to see the rest.</p>;
}

// A column header that sorts by `k`; a second click flips the direction. Other params stay.
export function SortLink({ k, label, base, q, sort, dir }: { k: string; label: string; base: string; q: Query; sort: string; dir: Dir }) {
  const active = sort === k;
  const next: Dir = active ? (dir === "desc" ? "asc" : "desc") : "desc";
  const Icon = active ? (dir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <Link href={withParams(base, q, { sort: k, dir: next })} className={`inline-flex items-center gap-0.5 hover:text-white ${active ? "text-white" : ""}`} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}>
      {label}
      <Icon className={`size-3.5 ${active ? "text-coral" : "opacity-40"}`} aria-hidden />
    </Link>
  );
}

// The time window, as a segmented control. Other params stay.
export function DaysPicker({ days, base, q = {} }: { days: number; base: string; q?: Query }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="admin-text-3 hidden text-xs sm:inline">Window</span>
      <div className="admin-panel-2 inline-flex rounded-xl border border-white/[0.06] p-0.5" role="group" aria-label="Time window">
        {[1, 3, 7, 14, 30, 90].map((d) => (
          <Link
            key={d}
            href={withParams(base, q, { days: String(d) })}
            aria-current={d === days ? "true" : undefined}
            className={`rounded-[10px] px-2.5 py-1 text-xs tabular-nums transition-colors ${d === days ? "bg-coral text-white" : "text-white/55 hover:bg-white/[0.06] hover:text-white"}`}
          >
            {d}d
          </Link>
        ))}
      </div>
    </div>
  );
}

export const daysParam = (sp: { days?: string }, fallback = 7) => Math.min(365, Math.max(1, Number(sp.days ?? fallback) || fallback));

export function UserLink({ id, name }: { id: string | undefined; name: string }) {
  if (!id) return <>{name}</>;
  return <Link href={`/admin/users/${id}`} className="text-white underline decoration-white/20 underline-offset-2 hover:decoration-coral">{name}</Link>;
}

export function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-white/20 underline-offset-2 hover:text-white hover:decoration-coral">{children}</a>;
}

// Plain GET form; hidden fields keep the window and sort while the person changes a filter.
export function FilterForm({ q, keep = ["days", "sort", "dir"], children }: { q: Query; keep?: string[]; children: React.ReactNode }) {
  return (
    <form method="get" className="flex flex-wrap items-center gap-2 text-sm">
      {keep.filter((k) => q[k]).map((k) => <input key={k} type="hidden" name={k} value={q[k]} />)}
      {children}
      <button type="submit" className="rounded-xl bg-coral px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#b5585a]">Apply</button>
    </form>
  );
}
const FIELD = "admin-panel-2 rounded-xl border border-white/[0.08] px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-white/25 focus:outline-none";
export function TextInput({ name, value, placeholder, size = 18 }: { name: string; value?: string; placeholder: string; size?: number }) {
  return <input name={name} defaultValue={value ?? ""} placeholder={placeholder} size={size} className={FIELD} />;
}
export function Select({ name, value, options, blank }: { name: string; value?: string; options: [string, string][]; blank: string }) {
  return (
    <select name={name} defaultValue={value ?? ""} className={FIELD}>
      <option value="">{blank}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}
export function Check({ name, checked, label }: { name: string; checked?: boolean; label: string }) {
  return (
    <label className="admin-text-2 flex items-center gap-1.5 py-1.5 text-sm hover:text-white">
      <input type="checkbox" name={name} value="1" defaultChecked={checked} className="accent-coral" /> {label}
    </label>
  );
}
export function ClearLink({ href }: { href: string }) {
  return <Link href={href} className="admin-text-3 px-1 py-1.5 text-sm hover:text-white">Clear</Link>;
}

// ---- charts ------------------------------------------------------------------------------

// The fixed chart palette: coral first, then teal, amber, slate; blue and plum only when a
// chart has more series than that. Values are Tailwind text classes (bars use currentColor).
export const CHART = {
  coral: "text-coral",
  teal: "text-teal-400",
  amber: "text-amber-400",
  slate: "text-slate-400",
  blue: "text-sky-400",
  plum: "text-violet-400",
  mist: "text-white/35",
} as const;
export type Series = { label: string; values: number[]; color: string };

// A bar with only its top corners rounded.
const topRounded = (x: number, y: number, w: number, h: number, r: number) => {
  const rr = Math.min(r, w / 2, h);
  return `M${x} ${y + h} V${y + rr} Q${x} ${y} ${x + rr} ${y} H${x + w - rr} Q${x + w} ${y} ${x + w} ${y + rr} V${y + h} Z`;
};

// Per-day bars as inline SVG. One series: plain bars. Several: stacked (default) or grouped.
// 680 wide, responsive via viewBox; gridlines at 20%; bars grow from the baseline on load.
export function BarChart({ title, keys, series, stacked = true, height = 150, format = (n: number) => String(Math.round(n)) }: {
  title: string;
  keys: string[];
  series: Series[];
  stacked?: boolean;
  height?: number;
  format?: (n: number) => string;
}) {
  const W = 680;
  const padL = 36;
  const padB = 20;
  const padT = 8;
  const innerW = W - padL - 6;
  const innerH = height - padB - padT;
  const n = Math.max(1, keys.length);
  const totals = keys.map((_, i) => (stacked ? series.reduce((a, s) => a + (s.values[i] ?? 0), 0) : Math.max(...series.map((s) => s.values[i] ?? 0))));
  const max = Math.max(1, ...totals);
  const slot = innerW / n;
  const gap = Math.min(4, slot * 0.25);
  const barW = Math.max(1, slot - gap);
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  // At most ~10 x labels, so they stay readable on long windows.
  const every = Math.ceil(n / 10);
  const total = series.reduce((a, s) => a + s.values.reduce((x, v) => x + v, 0), 0);
  const grid = [0, 0.25, 0.5, 0.75, 1];
  return (
    <figure className="w-full">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-display text-sm font-medium text-white">{title}</span>
        <span className="admin-text-3 text-xs tabular-nums">{format(total)} total</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${height}`} className="mt-2 w-full max-w-[680px]" role="img" aria-label={title}>
        <g className="text-white/20" stroke="currentColor">
          {grid.map((g) => (
            <line key={g} x1={padL} x2={W - 6} y1={y(max * g)} y2={y(max * g)} strokeDasharray={g === 0 ? undefined : "2 4"} />
          ))}
        </g>
        <g className="text-white/45" fill="currentColor" fontSize="11" textAnchor="end">
          <text x={padL - 6} y={y(0) + 4}>0</text>
          <text x={padL - 6} y={y(max / 2) + 4}>{format(max / 2)}</text>
          <text x={padL - 6} y={y(max) + 4}>{format(max)}</text>
        </g>
        {keys.map((k, i) => {
          const x0 = padL + i * slot + gap / 2;
          const tooltip = `${k}: ${series.map((s) => `${s.label} ${format(s.values[i] ?? 0)}`).join(", ")}`;
          // The topmost segment of a stacked column is the one that gets rounded corners.
          let topIdx = -1;
          series.forEach((s, si) => {
            if ((s.values[i] ?? 0) > 0) topIdx = si;
          });
          let acc = 0;
          return (
            <g key={k}>
              {totals[i] > 0 && (
                <g className="admin-grow" style={{ ["--i" as string]: i }}>
                  <title>{tooltip}</title>
                  {series.map((s, si) => {
                    const v = s.values[i] ?? 0;
                    if (v <= 0) return null;
                    if (stacked) {
                      const top = y(acc + v);
                      const h = Math.max(0, y(acc) - top);
                      acc += v;
                      return <path key={s.label} d={si === topIdx ? topRounded(x0, top, barW, h, 3) : `M${x0} ${top} h${barW} v${h} h${-barW} Z`} fill="currentColor" className={s.color} />;
                    }
                    const gw = barW / series.length;
                    const top = y(v);
                    return <path key={s.label} d={topRounded(x0 + si * gw, top, Math.max(1, gw - 1), Math.max(0, y(0) - top), 2)} fill="currentColor" className={s.color} />;
                  })}
                </g>
              )}
              {i % every === 0 && (
                <text x={x0 + barW / 2} y={height - 5} fontSize="11" textAnchor="middle" fill="currentColor" className="text-white/45">
                  {k.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <ul className="admin-text-2 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {series.map((s) => (
            <li key={s.label} className="flex items-center gap-1.5">
              <span className={`inline-block size-2 rounded-full ${s.color.replace("text-", "bg-")}`} /> {s.label} <span className="admin-text-3 tabular-nums">· {format(s.values.reduce((a, v) => a + v, 0))}</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

// Onboarding steps: label left, count right, a bar that widens on load. The step that lost
// the biggest share of the step before gets a coral marker and a note.
export function Funnel({ steps }: { steps: { label: string; count: number; href?: string }[] }) {
  const top = Math.max(1, steps[0]?.count ?? 1);
  let dropAt = -1;
  let worst = 1;
  steps.forEach((s, i) => {
    if (i === 0) return;
    const prev = steps[i - 1].count;
    const share = prev ? s.count / prev : 1;
    if (prev > 0 && share < worst) {
      worst = share;
      dropAt = i;
    }
  });
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const prev = i === 0 ? s.count : steps[i - 1].count;
        const share = i === 0 ? null : prev ? Math.round((s.count / prev) * 100) : 0;
        const width = Math.max(1.5, Math.round((s.count / top) * 100));
        const isDrop = i === dropAt;
        return (
          <li key={s.label} className="text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className={`flex items-center gap-2 ${isDrop ? "text-white" : "admin-text-2"}`}>
                {isDrop && <span className="size-1.5 rounded-full bg-coral" aria-hidden />}
                {s.href ? <Link href={s.href} className="hover:text-white">{s.label}</Link> : s.label}
              </span>
              <span className="shrink-0 tabular-nums text-white">
                {s.count}
                {share != null && <span className={`text-xs ${isDrop ? "text-coral" : "admin-text-3"}`}> · {share}%</span>}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.05]">
              <div className={`admin-widen h-2 rounded-full ${isDrop ? "bg-coral" : "bg-white/30"}`} style={{ width: `${width}%`, ["--i" as string]: i }} />
            </div>
            {isDrop && <p className="mt-1 text-xs text-coral">Biggest drop here: {100 - (share ?? 0)}% of the step before did not make it.</p>}
          </li>
        );
      })}
    </ol>
  );
}

// Things worth a look right now. Zero means fine; anything else links to where to look.
// When every check is zero, Mochi says so.
export function Alerts({ items }: { items: { label: string; count: number; href: string; hint?: string }[] }) {
  if (items.every((a) => a.count === 0)) {
    return (
      <div>
        <Empty mood="happy">All quiet. Every check is at zero.</Empty>
        <ul className="admin-text-3 mt-2 space-y-1 text-xs">
          {items.map((a) => (
            <li key={a.label} className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-slate-500/60" aria-hidden /> {a.label}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <ul className="-mx-2 text-sm">
      {items.map((a) => (
        <li key={a.label} className={a.count ? "" : "opacity-50"}>
          <Link href={a.href} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.04]">
            <span className={`size-2 shrink-0 rounded-full ${a.count ? "bg-rose-400" : "bg-slate-500/60"}`} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-white">{a.label}</span>
              {a.hint && a.count > 0 && <span className="admin-text-3 block truncate text-xs" title={a.hint}>{a.hint}</span>}
            </span>
            <Badge tone={a.count ? "rose" : "muted"}>{a.count}</Badge>
            <ChevronRight className="admin-text-3 size-4 shrink-0" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Label/value pairs for detail pages.
export function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="admin-text-3 text-[11px] font-semibold uppercase tracking-wide sm:pt-0.5">{k}</dt>
          <dd className="break-words text-white/85">{v === "" || v == null ? <span className="admin-text-3">–</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}

// Content width and padding shared by every admin page.
export function Page({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-6xl px-5 pb-12 lg:px-8">{children}</main>;
}
