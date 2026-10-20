import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Ninja } from "@/components/brand";
import { LandingHeader } from "@/components/landing-header";
import { launchMode } from "@/lib/launch";

// The shell for the public pages beside the landing page: same header, same dark page, the same
// closing call to action and footer, so they read as one site.
export function PublicPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: React.ReactNode }) {
  const open = launchMode === "open";
  const action = open ? { label: "Log in", href: "/auth/login" } : { label: "Join the waitlist", href: "/#top" };
  return (
    <div className="flex flex-1 flex-col bg-night text-white">
      <LandingHeader action={action} />
      <main className="flex-1 px-[6%] pb-16 pt-24 sm:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-coral">{eyebrow}</p>
          <h1 className="font-display mt-4 text-[2.2rem] font-medium leading-[1.1] tracking-[-0.01em] sm:text-[3rem]">{title}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-white/55">{intro}</p>
        </div>
        {children}
      </main>
      <section className="flex flex-col bg-night-2 px-[6%] pt-16">
        <div className="flex flex-col items-center pb-14 text-center">
          <Ninja mood="love" className="size-20" />
          <h2 className="font-display mt-5 text-[1.6rem] font-medium tracking-[-0.01em] sm:text-[2rem]">Your next job is already posted somewhere.</h2>
          <p className="mt-3 text-base text-white/55">Let your headhunter go and find it.</p>
          <a href={open ? "/auth/login" : "/#top"} className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-coral px-8 text-base font-medium text-white transition-colors hover:bg-rose">
            {open ? "Get my headhunter" : "Join the waitlist"} <ArrowRight className="size-4" aria-hidden />
          </a>
        </div>
        <footer className="flex flex-col items-center gap-4 py-8 text-sm text-white/45 sm:flex-row sm:justify-between">
          <span>© 2026 Career Ninja</span>
          <span className="flex gap-6">
            <Link href="/" className="hover:text-white">
              Home
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Privacy Policy
            </Link>
          </span>
          <span>
            In partnership with <span className="font-medium text-white">Minds</span> by Animoca Brands
          </span>
        </footer>
      </section>
    </div>
  );
}
