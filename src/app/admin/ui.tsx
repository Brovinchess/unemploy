import Link from "next/link";
import type { Dir, Query } from "@/lib/admin";
import { withParams } from "@/lib/admin";

// Small building blocks for the admin pages. Server-safe, no state.

export function PageHead({ section, title, children }: { section: string; title: string; children?: React.ReactNode }) {
  return (
    <>
      <p className="text-sm text-white/45">{section}</p>
      <h1 className="font-display mt-1 text-3xl font-medium">{title}</h1>
      {children}
    </>
  );
}

export function Card({ title, hint, children, className = "" }: { title?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl bg-surface p-5 ${className}`}>
      {title && <h2 className="font-display font-medium text-white">{title}</h2>}
      {hint && <p className="mt-0.5 text-xs text-white/45">{hint}</p>}
      <div className={title ? "mt-3" : ""}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, href }: { label: string; value: string | number; hint?: string; href?: string }) {
  const body = (
    <>
      <p className="text-xs uppercase tracking-wide text-white/45">{label}</p>
      <p className="font-display mt-1 text-2xl text-white">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-white/40">{hint}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-2xl bg-surface p-4 hover:bg-white/[0.07]">{body}</Link>
  ) : (
    <div className="rounded-2xl bg-surface p-4">{body}</div>
  );
}

export function Counts({ title, rows, total }: { title: string; rows: [string, number][]; total: number }) {
  return (
    <section className="rounded-3xl bg-surface p-5">
      <h2 className="font-display font-medium text-white">{title}</h2>
      {rows.length === 0 && <p className="mt-3 text-sm text-white/40">Nothing in this window.</p>}
      <ul className="mt-3 space-y-1.5 text-sm">
        {rows.map(([k, n]) => (
          <li key={k} className="flex items-center justify-between gap-4">
            <span className="text-white/75">{k}</span>
            <span className="tabular-nums text-white/50">
              {n} <span className="text-white/30">· {Math.round((n / Math.max(1, total)) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Tables scroll inside their border; headers may be plain text or SortLinks.
export function Table({ head, rows, empty = "Nothing to show." }: { head: React.ReactNode[]; rows: React.ReactNode[][]; empty?: string }) {
  if (!rows.length) return <p className="rounded-2xl border border-white/[0.06] px-4 py-6 text-sm text-white/40">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-white/45">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 text-white/80">{c}</td>
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
  return <p className="mt-2 text-xs text-white/40">Showing the first {shown} of {total} rows. Narrow the window or filters to see the rest.</p>;
}

// A column header that sorts by `k`; a second click flips the direction. Other params stay.
export function SortLink({ k, label, base, q, sort, dir }: { k: string; label: string; base: string; q: Query; sort: string; dir: Dir }) {
  const active = sort === k;
  const next: Dir = active ? (dir === "desc" ? "asc" : "desc") : "desc";
  return (
    <Link href={withParams(base, q, { sort: k, dir: next })} className={`inline-flex items-center gap-1 hover:text-white ${active ? "text-white" : ""}`}>
      {label}
      <span className={`text-[10px] ${active ? "text-coral" : "text-white/25"}`}>{active ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
    </Link>
  );
}

export function DaysPicker({ days, base, q = {} }: { days: number; base: string; q?: Query }) {
  return (
    <p className="text-sm text-white/55">
      Last {days} {days === 1 ? "day" : "days"}.{" "}
      {[1, 3, 7, 14, 30, 90].map((d) => (
        <Link key={d} href={withParams(base, q, { days: String(d) })} className={`mr-2 underline-offset-2 ${d === days ? "text-white underline" : "text-white/50 hover:text-white"}`}>
          {d}d
        </Link>
      ))}
    </p>
  );
}

export const daysParam = (sp: { days?: string }, fallback = 7) => Math.min(365, Math.max(1, Number(sp.days ?? fallback) || fallback));

export function UserLink({ id, name }: { id: string | undefined; name: string }) {
  if (!id) return <>{name}</>;
  return <Link href={`/admin/users/${id}`} className="underline decoration-white/20 underline-offset-2 hover:text-white">{name}</Link>;
}

export function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-white/20 underline-offset-2 hover:text-white">{children}</a>;
}

// Plain GET form; hidden fields keep the window and sort while the person changes a filter.
export function FilterForm({ q, keep = ["days", "sort", "dir"], children }: { q: Query; keep?: string[]; children: React.ReactNode }) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
      {keep.filter((k) => q[k]).map((k) => <input key={k} type="hidden" name={k} value={q[k]} />)}
      {children}
      <button type="submit" className="rounded-xl bg-white/[0.08] px-3 py-1.5 text-white hover:bg-white/[0.12]">Apply</button>
    </form>
  );
}
export function TextInput({ name, value, placeholder, size = 18 }: { name: string; value?: string; placeholder: string; size?: number }) {
  return <input name={name} defaultValue={value ?? ""} placeholder={placeholder} size={size} className="rounded-xl border border-white/[0.08] bg-night px-3 py-1.5 text-white placeholder:text-white/30" />;
}
export function Select({ name, value, options, blank }: { name: string; value?: string; options: [string, string][]; blank: string }) {
  return (
    <select name={name} defaultValue={value ?? ""} className="rounded-xl border border-white/[0.08] bg-night px-3 py-1.5 text-white">
      <option value="">{blank}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}
export function Check({ name, checked, label }: { name: string; checked?: boolean; label: string }) {
  return (
    <label className="flex items-center gap-1.5 py-1.5 text-white/70">
      <input type="checkbox" name={name} value="1" defaultChecked={checked} className="accent-coral" /> {label}
    </label>
  );
}

// ---- charts ------------------------------------------------------------------------------

export type Series = { label: string; values: number[]; color: string }; // color: a Tailwind text class

// Per-day bars as inline SVG. One series: plain bars. Several: stacked (default) or grouped.
// 680 wide, responsive via viewBox; labels in 11px; bars take their colour from currentColor.
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
  return (
    <figure className="w-full">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-display text-sm font-medium text-white">{title}</span>
        <span className="text-xs tabular-nums text-white/45">{format(total)} total</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${height}`} className="mt-2 w-full max-w-[680px]" role="img" aria-label={title}>
        <g className="text-white/10" stroke="currentColor">
          <line x1={padL} x2={W - 6} y1={y(0)} y2={y(0)} />
          <line x1={padL} x2={W - 6} y1={y(max / 2)} y2={y(max / 2)} strokeDasharray="2 4" />
          <line x1={padL} x2={W - 6} y1={y(max)} y2={y(max)} strokeDasharray="2 4" />
        </g>
        <g className="text-white/45" fill="currentColor" fontSize="11" textAnchor="end">
          <text x={padL - 6} y={y(0) + 4}>0</text>
          <text x={padL - 6} y={y(max / 2) + 4}>{format(max / 2)}</text>
          <text x={padL - 6} y={y(max) + 4}>{format(max)}</text>
        </g>
        {keys.map((k, i) => {
          const x0 = padL + i * slot + gap / 2;
          let acc = 0;
          return (
            <g key={k}>
              <title>{`${k}: ${series.map((s) => `${s.label} ${format(s.values[i] ?? 0)}`).join(", ")}`}</title>
              {series.map((s, si) => {
                const v = s.values[i] ?? 0;
                let rect: React.ReactNode;
                if (stacked) {
                  rect = <rect key={s.label} x={x0} width={barW} y={y(acc + v)} height={Math.max(0, y(acc) - y(acc + v))} fill="currentColor" className={s.color} rx={1} />;
                  acc += v;
                } else {
                  const gw = barW / series.length;
                  rect = <rect key={s.label} x={x0 + si * gw} width={Math.max(1, gw - 1)} y={y(v)} height={Math.max(0, y(0) - y(v))} fill="currentColor" className={s.color} rx={1} />;
                }
                return rect;
              })}
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
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/55">
          {series.map((s) => (
            <li key={s.label} className="flex items-center gap-1.5">
              <span className={`inline-block size-2.5 rounded-sm ${s.color.replace("text-", "bg-")}`} /> {s.label} · {format(s.values.reduce((a, v) => a + v, 0))}
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

// Onboarding steps: each with its count and the share of the step before it.
export function Funnel({ steps }: { steps: { label: string; count: number; href?: string }[] }) {
  const top = Math.max(1, steps[0]?.count ?? 1);
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => {
        const prev = i === 0 ? s.count : steps[i - 1].count;
        const share = i === 0 ? null : prev ? Math.round((s.count / prev) * 100) : 0;
        const width = Math.max(2, Math.round((s.count / top) * 100));
        return (
          <li key={s.label} className="text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-white/75">{s.href ? <Link href={s.href} className="hover:text-white">{s.label}</Link> : s.label}</span>
              <span className="tabular-nums text-white/50">
                {s.count}
                {share != null && <span className="text-white/30"> · {share}% of previous</span>}
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-white/[0.05]">
              <div className="h-2 rounded-full bg-coral/70" style={{ width: `${width}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// Things worth a look right now. Zero means fine; anything else links to where to look.
export function Alerts({ items }: { items: { label: string; count: number; href: string; hint?: string }[] }) {
  return (
    <ul className="divide-y divide-white/[0.05] text-sm">
      {items.map((a) => (
        <li key={a.label} className="flex items-center justify-between gap-4 py-2">
          <div>
            <Link href={a.href} className={a.count ? "text-white hover:underline" : "text-white/45 hover:text-white"}>{a.label}</Link>
            {a.hint && a.count > 0 && <p className="text-xs text-white/40">{a.hint}</p>}
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs tabular-nums ${a.count ? "bg-coral/20 text-coral" : "bg-white/[0.05] text-white/40"}`}>{a.count}</span>
        </li>
      ))}
    </ul>
  );
}

// Label/value pairs for detail pages.
export function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[max-content_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-white/45">{k}</dt>
          <dd className="break-words text-white/85">{v === "" || v == null ? <span className="text-white/30">–</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}
