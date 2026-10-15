import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { Ninja } from "@/components/brand";
import { MOCHI_CAPTION, requireAdmin, timeOfDay } from "@/lib/admin";
import { AdminNav } from "./nav";

export const metadata: Metadata = { title: "Career Ninja admin", robots: { index: false, follow: false } };
// Every admin page reads live data and the session; never pre-rendered at build time.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const caption = MOCHI_CAPTION[timeOfDay(user.timezone)];
  return (
    <div className="admin flex min-h-svh flex-col lg:flex-row">
      <aside className="admin-panel shrink-0 border-x-0 border-t-0 px-4 py-3 lg:sticky lg:top-0 lg:flex lg:h-svh lg:w-60 lg:flex-col lg:border-b-0 lg:border-r lg:py-5">
        <div className="flex items-center justify-between gap-3 lg:block">
          <a href="/admin" className="flex items-center gap-2.5 px-1">
            <Ninja className="size-8" />
            <span className="font-display text-base font-semibold tracking-tight text-white">
              careerninja<span className="text-coral">.</span>
            </span>
            <span className="rounded-full border border-white/[0.1] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/60">admin</span>
          </a>
          <p className="admin-text-3 truncate text-xs lg:hidden">{user.username}</p>
        </div>
        <div className="mt-3 lg:mt-0 lg:flex-1 lg:overflow-y-auto">
          <AdminNav />
        </div>
        <div className="hidden lg:block">
          <div className="admin-line mt-4 border-t pt-4">
            <div className="flex items-center gap-3 px-1">
              <Ninja mood="sleeping" className="bob-sm size-9 shrink-0" />
              <p className="admin-text-3 text-xs leading-snug">{caption}</p>
            </div>
            <p className="admin-text-3 mt-4 px-1 text-xs">
              Signed in as <span className="text-white/80">{user.username}</span>
            </p>
            <a href="https://careerninja.app/app" className="admin-text-2 mt-1.5 inline-flex items-center gap-1.5 px-1 text-xs hover:text-white">
              Open the app <ExternalLink className="size-3" aria-hidden />
            </a>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
