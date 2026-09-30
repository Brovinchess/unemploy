import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDown, ArrowRight, BriefcaseBusiness, ChevronRight, Compass, Shield, Sparkles } from "lucide-react";
import { Mark } from "@/components/brand";
import { ApprovePanels, PackPanels, ProfilesPanels, ShortlistPanels, WideArt } from "@/components/landing-art";
import { LandingHeader } from "@/components/landing-header";
import { RotatingPhrase } from "@/components/rotating-phrase";
import { WaitlistForm } from "@/components/waitlist-form";
import { launchMode } from "@/lib/launch";
import { mindsConfig } from "@/lib/minds/config";
import { getCurrentUser } from "@/lib/session";

const LOGIN_ERRORS: Record<string, string> = {
  denied: "Sign-in was cancelled. You can try again whenever you're ready.",
  expired: "Sign-in took too long. Please try again.",
  state: "Something went wrong with sign-in. Please try again.",
  exchange: "Hello Minds couldn't complete sign-in. Please try again.",
  config: "Sign-in is temporarily unavailable. Please try again later.",
};

const PHRASES = ["finds jobs you'd win", "writes your applications", "works while you sleep", "never makes things up"];

const FEATURES = [
  {
    title: "Finds the few jobs worth your time",
    body: "Tell it where you want to work and what you're after. Every morning it brings you the best matches, ranked by how well you fit, with an honest note on why.",
    art: <ShortlistPanels />,
  },
  {
    title: "Writes every application from your real experience",
    body: "Each job comes with a cover letter and answers to its questions. Every claim is traced back to a line in your resume, so nothing is ever made up.",
    art: <PackPanels />,
  },
  {
    title: "Stay in control of what gets sent",
    body: "Nothing goes out without you. Apply or skip with one tap. Every skip teaches your headhunter what you don't want, and you can pause it any time.",
    art: <ApprovePanels />,
  },
  {
    title: "One headhunter for every kind of job you want",
    body: "Looking for design and product roles? Give each its own headhunter, resume and shortlist, in any country, on-site, hybrid or remote.",
    art: <ProfilesPanels />,
  },
];

const LEARN = [
  { icon: Compass, title: "How your headhunter works", body: "From your first brief to a daily shortlist, and what happens when you apply.", href: "#learn-more" },
  { icon: Shield, title: "Your privacy", body: "What we store, who sees it, and how to delete everything in one step.", href: "/privacy" },
  { icon: Sparkles, title: "Built on Hello Minds", body: "Your headhunter is an AI agent you own, running on the Hello Minds platform.", href: "https://hellominds.ai" },
];

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function Home({ searchParams }: PageProps<"/">) {
  const user = await getCurrentUser();
  if (user) redirect("/start");
  const sp = await searchParams;
  const error = LOGIN_ERRORS[one(sp.login_error) ?? ""];
  const deleted = sp.deleted === "1";
  const open = launchMode === "open";
  const action = open ? { label: "Log in", href: "/auth/login" } : { label: "Join the waitlist", href: "#top" };

  return (
    <div id="top" className="flex flex-1 flex-col bg-night text-white">
      <LandingHeader action={action} />

      {/* First screen */}
      <section className="relative flex min-h-svh flex-col items-center justify-center px-5 pt-15 pb-28 text-center">
        <Mark className="size-20 sm:size-24" />
        <h1 className="font-display mt-6 text-[2.6rem] font-medium leading-[1.1] tracking-[-0.01em] sm:text-[4rem]">
          <span className="whitespace-nowrap">
            Unemploy
            <span className="ml-2 inline-flex size-[0.95em] translate-y-[0.1em] items-center justify-center rounded-full bg-coral align-baseline sm:ml-3">
              <BriefcaseBusiness className="size-[0.48em] text-white" strokeWidth={2} aria-hidden />
            </span>
            , AI that
          </span>
          <br />
          <span className="text-coral">
            <RotatingPhrase phrases={PHRASES} />
          </span>
        </h1>

        <div className="mt-12 w-full">
          {open ? (
            <div className="mx-auto flex w-full max-w-[26rem] flex-col items-center gap-3">
              <Link href="/auth/login" className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-coral text-base font-medium text-white hover:bg-rose">
                Get your headhunter <ArrowRight className="size-4" aria-hidden />
              </Link>
              <span className="text-sm text-white/50">Sign in with your Hello Minds account</span>
            </div>
          ) : (
            <WaitlistForm referral={one(sp.ref)} source={one(sp.utm_source)} appUrl={mindsConfig.appUrl} />
          )}
        </div>
        {error && <p className="mt-6 rounded-xl bg-coral/15 px-4 py-3 text-sm text-coral">{error}</p>}
        {deleted && <p className="mt-6 text-sm text-white/60">Your account and data have been deleted.</p>}

        <a
          href="#learn-more"
          className="absolute bottom-8 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/[0.08] px-4 py-2.5 text-sm text-white/90 hover:bg-white/[0.14]"
        >
          Learn more <ArrowDown className="size-4" aria-hidden />
        </a>
      </section>

      <main id="learn-more" className="scroll-mt-15">
        {/* Centred statement with one wide picture */}
        <section className="bg-night-2 px-[6%] py-24 sm:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-3xl font-medium tracking-[-0.01em] sm:text-[2.5rem] sm:leading-[1.15]">
              Your own headhunter, working in the background
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-white/55">
              Upload your resume and answer a few questions. It searches every day, picks the jobs you&rsquo;d actually win, and
              writes your application for each one.
            </p>
          </div>
          <div className="mx-auto mt-14 max-w-[884px]" aria-hidden>
            <WideArt />
          </div>
        </section>

        {/* Full-width bands, alternating shade and side */}
        {FEATURES.map((f, i) => (
          <section key={f.title} className={`flex min-h-[92svh] items-center px-[6%] py-20 ${i % 2 ? "bg-night-2" : "bg-night"}`}>
            <div className="grid w-full items-center gap-14 md:grid-cols-2 md:gap-16">
              <div className={`flex justify-center ${i % 2 ? "md:order-2" : ""}`} aria-hidden>
                <div className="w-full origin-center md:scale-110 xl:scale-125">{f.art}</div>
              </div>
              <div className={i % 2 ? "md:order-1" : ""}>
                <h3 className="font-display max-w-[34rem] text-3xl font-medium tracking-[-0.01em] sm:text-[2.5rem] sm:leading-[1.15]">{f.title}</h3>
                <p className="mt-4 max-w-[36rem] text-lg leading-relaxed text-white/55">{f.body}</p>
              </div>
            </div>
          </section>
        ))}

        {/* Learn more, like Muse's list of links */}
        <section className="bg-night px-[6%] py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[1fr_1.4fr]">
            <div>
              <h2 className="font-display text-3xl font-medium tracking-[-0.01em] sm:text-[2.5rem] sm:leading-[1.15]">Learn more about Unemploy</h2>
              <p className="mt-4 max-w-sm text-lg leading-relaxed text-white/55">What it does, how it protects you, and who it&rsquo;s built on.</p>
            </div>
            <ul>
              {LEARN.map((l) => (
                <li key={l.title}>
                  <a href={l.href} className="group flex items-start gap-5 py-6">
                    <l.icon className="mt-0.5 size-5 shrink-0 text-white/60" aria-hidden />
                    <span className="flex flex-1 items-center gap-6 border-b border-white/[0.08] pb-6">
                      <span className="flex-1">
                        <span className="block text-lg font-medium text-white">{l.title}</span>
                        <span className="mt-1 block text-white/55">{l.body}</span>
                      </span>
                      <ChevronRight className="size-5 text-white/40 transition-transform group-hover:translate-x-1" aria-hidden />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Last screen, with the footer at its foot */}
        <section className="flex min-h-svh flex-col bg-night px-[6%] pt-15">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <h2 className="font-display text-3xl font-medium tracking-[-0.01em] sm:text-[2.5rem]">Ready to stop applying blindly?</h2>
            <a
              href={action.href}
              className="mt-8 inline-flex h-12 w-64 items-center justify-center rounded-full bg-coral text-base font-medium text-white transition-colors hover:bg-rose"
            >
              {action.label}
            </a>
          </div>
          <footer className="flex flex-col items-center gap-4 py-8 text-sm text-white/45 sm:flex-row sm:justify-between">
            <span>© 2026 Unemploy</span>
            <span className="flex gap-6">
              <Link href="/privacy" className="hover:text-white">
                Privacy Policy
              </Link>
            </span>
            <span>
              powered by <span className="font-medium text-white">Hello Minds</span>
            </span>
          </footer>
        </section>
      </main>
    </div>
  );
}
