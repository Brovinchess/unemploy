import Link from "next/link";

// Small building blocks for the admin pages. Server-safe, no state.
export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-white/45">{label}</p>
      <p className="font-display mt-1 text-2xl text-white">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-white/40">{hint}</p>}
    </div>
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

export function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return <p className="rounded-2xl border border-white/[0.06] px-4 py-6 text-sm text-white/40">Nothing to show.</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-white/45">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">{h}</th>
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

export function DaysPicker({ days, base }: { days: number; base: string }) {
  return (
    <p className="text-sm text-white/55">
      Last {days} {days === 1 ? "day" : "days"}.{" "}
      {[1, 3, 7, 14, 30, 90].map((d) => (
        <Link key={d} href={`${base}?days=${d}`} className={`mr-2 underline-offset-2 ${d === days ? "text-white underline" : "text-white/50 hover:text-white"}`}>
          {d}d
        </Link>
      ))}
    </p>
  );
}

export const daysParam = (sp: { days?: string }, fallback = 7) => Math.min(365, Math.max(1, Number(sp.days ?? fallback) || fallback));
