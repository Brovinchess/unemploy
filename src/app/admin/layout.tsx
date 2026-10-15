import Link from "next/link";
import type { Metadata } from "next";
import { Ninja } from "@/components/brand";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Career Ninja admin", robots: { index: false, follow: false } };

const NAV = [
  ["/admin", "Overview"],
  ["/admin/users", "Users"],
  ["/admin/searches", "Searches"],
  ["/admin/jobs", "Jobs"],
  ["/admin/leads", "Dropped leads"],
  ["/admin/referrals", "Referrals"],
  ["/admin/waitlist", "Waitlist"],
  ["/admin/system", "System"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <div className="flex min-h-svh flex-col bg-night text-white lg:flex-row">
      <aside className="border-b border-white/[0.06] bg-[#10161c] px-4 py-4 lg:sticky lg:top-0 lg:h-svh lg:w-56 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 px-2">
          <Ninja className="size-7" />
          <span className="font-display font-semibold">careerninja<span className="text-coral">.</span> admin</span>
        </div>
        <nav className="mt-4 flex gap-1 overflow-x-auto lg:flex-col" aria-label="Admin">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="shrink-0 rounded-xl px-3 py-2 text-sm text-white/65 hover:bg-white/[0.06] hover:text-white">
              {label}
            </Link>
          ))}
        </nav>
        <p className="mt-6 px-3 text-xs text-white/35">
          Signed in as {user.username}.{" "}
          <a href="https://careerninja.app/app" className="underline underline-offset-2 hover:text-white">Open the app</a>
        </p>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
