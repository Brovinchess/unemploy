"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bot, Briefcase, Coins, FileText, Kanban, LayoutDashboard, MessageSquare, Search, ShieldCheck, TrendingUp, Users, type LucideIcon } from "lucide-react";

// Sidebar sections. On admin.careerninja.app the browser path has no /admin prefix (the
// proxy adds it), so both sides are compared without it.
const GROUPS: [string, [string, string, LucideIcon][]][] = [
  [
    "Product",
    [
      ["/admin", "Overview", LayoutDashboard],
      ["/admin/headhunters", "Headhunters", Bot],
      ["/admin/briefs", "Briefs", FileText],
      ["/admin/searches", "Searches", Search],
      ["/admin/jobs", "Jobs", Briefcase],
      ["/admin/quality", "Quality", ShieldCheck],
    ],
  ],
  [
    "People",
    [
      ["/admin/users", "Users", Users],
      ["/admin/applications", "Applications", Kanban],
      ["/admin/feedback", "Feedback", MessageSquare],
      ["/admin/growth", "Growth", TrendingUp],
    ],
  ],
  [
    "Operations",
    [
      ["/admin/costs", "Costs", Coins],
      ["/admin/system", "System", Activity],
    ],
  ],
];

const strip = (p: string) => p.replace(/^\/admin(?=\/|$)/, "") || "/";

// On desktop a vertical list in three groups; on phones one horizontal, scrollable row of tabs.
export function AdminNav() {
  const here = strip(usePathname() ?? "/");
  const isActive = (href: string) => {
    const target = strip(href);
    return target === "/" ? here === "/" : here === target || here.startsWith(`${target}/`);
  };
  return (
    <nav className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:mt-6 lg:flex-col lg:gap-5 lg:overflow-visible lg:px-0" aria-label="Admin">
      {GROUPS.map(([group, items]) => (
        <div key={group} className="flex shrink-0 gap-1 lg:block">
          <p className="admin-text-3 hidden px-3 text-[11px] font-semibold uppercase tracking-wide lg:block">{group}</p>
          <div className="flex gap-1 lg:mt-1.5 lg:flex-col">
            {items.map(([href, label, Icon]) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
                    active ? "admin-nav-active bg-white/[0.06] text-white" : "text-white/60 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <Icon className={`size-4 shrink-0 ${active ? "text-coral" : "opacity-70"}`} aria-hidden />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
