"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Sidebar sections. On admin.careerninja.app the browser path has no /admin prefix (the
// proxy adds it), so both sides are compared without it.
const GROUPS: [string, [string, string][]][] = [
  [
    "Product",
    [
      ["/admin", "Overview"],
      ["/admin/headhunters", "Headhunters"],
      ["/admin/searches", "Searches"],
      ["/admin/jobs", "Jobs"],
      ["/admin/quality", "Quality"],
    ],
  ],
  [
    "People",
    [
      ["/admin/users", "Users"],
      ["/admin/applications", "Applications"],
      ["/admin/growth", "Growth"],
    ],
  ],
  [
    "Operations",
    [
      ["/admin/costs", "Costs"],
      ["/admin/system", "System"],
    ],
  ],
];

const strip = (p: string) => p.replace(/^\/admin(?=\/|$)/, "") || "/";

export function AdminNav() {
  const here = strip(usePathname() ?? "/");
  const isActive = (href: string) => {
    const target = strip(href);
    return target === "/" ? here === "/" : here === target || here.startsWith(`${target}/`);
  };
  return (
    <nav className="mt-4 flex gap-4 overflow-x-auto lg:flex-col lg:gap-3" aria-label="Admin">
      {GROUPS.map(([group, items]) => (
        <div key={group} className="shrink-0">
          <p className="px-3 text-[10px] uppercase tracking-wider text-white/30">{group}</p>
          <div className="mt-1 flex gap-1 lg:flex-col">
            {items.map(([href, label]) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 rounded-xl px-3 py-1.5 text-sm ${active ? "bg-white/[0.08] text-white" : "text-white/65 hover:bg-white/[0.06] hover:text-white"}`}
                >
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
