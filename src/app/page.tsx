import Link from "next/link";
import { redirect } from "next/navigation";
import { count } from "drizzle-orm";
import { ArrowDown, ArrowRight, ChevronRight, Compass, Shield, Sparkles } from "lucide-react";
import { Mark, Ninja } from "@/components/brand";
import { ApprovePanels, PackPanels, ProfilesPanels, ShortlistPanels, WideArt } from "@/components/landing-art";
import { LandingHeader } from "@/components/landing-header";
import { RotatingPhrase } from "@/components/rotating-phrase";
import { WaitlistForm } from "@/components/waitlist-form";
import { db, schema } from "@/db";
import { codeSignupAvailable } from "@/lib/email";
import { launchMode } from "@/lib/launch";
import { mindsConfig } from "@/lib/minds/config";
import { estimateSearchCost, MAX_JOBS_PER_SEARCH, MIN_JOBS_PER_SEARCH } from "@/lib/preferences";
import { getCurrentUser } from "@/lib/session";

const LOGIN_ERRORS: Record<string, string> = {
  denied: "Sign-in was cancelled. You can try again whenever you're ready.",
  expired: "Sign-in took too long. Please try again.",
  state: "Something went wrong with sign-in. Please try again.",
  exchange: "Hello Minds couldn't complete sign-in. Please try again.",
  config: "Sign-in is temporarily unavailable. Please try again later.",
};

const PHRASES = ["finds jobs you'd win", "writes your applications", "searches when you ask", "never makes things up"];

// Everything below is true of the product today; numbers come from the same code the app uses.
const FIVE_JOBS = estimateSearchCost(5);
const MIN_JOBS = MIN_JOBS_PER_SEARCH;
const MAX_JOBS = MAX_JOBS_PER_SEARCH;

// Show the live waitlist size once it's big enough to help rather than hurt.
const SHOW_WAITLIST_FROM = 50;

const FACTS = [
  { n: `${MIN_JOBS}–${MAX_JOBS}`, label: "checked jobs per search, you choose" },
  { n: "6", label: "filters: setting, type, level, salary, visa, companies to avoid" },
  { n: "0", label: "claims without a line in your resume behind them" },
  { n: `~$${FIVE_JOBS.usd.toFixed(2)}`, label: "for a search of 5 jobs, paid in Hello Minds cognition. Nothing between searches" },
];

const STEPS = [
  { title: "Sign in with Hello Minds", body: "One click creates your own headhunter. It belongs to you, not to us." },
  { title: "Upload your resume", body: "Then answer 9 quick questions: roles, country, work setting, level, salary and more." },
  { title: "Search when you want", body: "Click Find jobs and it brings the best matches, each checked open and written up, ready to paste." },
];

const FAQ = [
  {
    q: "Does it apply for me?",
    a: "Not on its own. It finds the job and writes the application; you read it, then apply on the company's site with one click. Nothing is ever sent without you.",
  },
  {
    q: "What does it cost?",
    a: `Career Ninja itself is free. Your headhunter runs on Hello Minds and uses cognition, which you top up on hellominds.ai. It only searches when you ask: a search for 5 jobs uses about ${FIVE_JOBS.cognition} cognition, roughly $${FIVE_JOBS.usd.toFixed(2)}. Between searches it's switched off and spends nothing.`,
  },
  {
    q: "Which jobs and countries does it cover?",
    a: "Any field, any country. You choose on-site, hybrid or remote, job type, seniority, a minimum salary, companies to avoid, and whether you need visa sponsorship.",
  },
  {
    q: "Will it make things up about me?",
    a: "No. Every claim in a cover letter has to point to a line in your resume. If it can't, that job is thrown out before you see it. Dead job links are checked and removed too.",
  },
  {
    q: "What happens to my resume?",
    a: "It's used only to find and write for your jobs. You can delete your account, resume and every job in one step from Settings.",
  },
  {
    q: "Who can join?",
    a: "Anyone 18 or over. We're letting people in from the waitlist in order, and we'll email you when it's your turn.",
  },
];

const FEATURES = [
  {
    title: "Finds the few jobs worth your time",
    body: "Tell it what you want once. Whenever you ask, it brings you a short list of real, open jobs ranked by how well you fit, each with a plain note on why it fits and what might hold you back.",
    art: <ShortlistPanels />,
  },
  {
    title: "Writes every application from your real experience",
    body: "Each job comes with a tailored cover letter and answers to its application questions. Every claim links back to the line in your resume it came from, so you can check it in a second.",
    art: <PackPanels />,
  },
  {
    title: "Stay in control of what gets sent",
    body: "Nothing goes out without you. Apply or skip in one tap, and tell it why you skipped so the next list is better. Track every application from saved to offer, and pause whenever you like.",
    art: <ApprovePanels />,
  },
  {
    title: "One headhunter for every kind of job you want",
    body: "Open to design and product roles? Give each its own headhunter with its own resume, filters and shortlist, so neither search waters down the other.",
    art: <ProfilesPanels />,
  },
];

const LEARN = [
  { icon: Compass, title: "Questions and answers", body: "Cost, countries, privacy, and what it will and won't do for you.", href: "#faq" },
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
  const [{ n: waiting }] = open ? [{ n: 0 }] : await db.select({ n: count() }).from(schema.waitlist);

  return (
    <div id="top" className="flex flex-1 flex-col bg-night text-white">
      <LandingHeader action={action} />

      {/* First screen */}
      <section className="relative flex min-h-svh flex-col items-center justify-center px-5 pt-15 pb-28 text-center">
        <Mark className="size-20 sm:size-24" />
        <h1 className="font-display mt-6 text-[2.6rem] font-medium leading-[1.1] tracking-[-0.01em] sm:text-[4rem]">
          Career Ninja
          <span className="whitespace-nowrap">
            <Ninja className="ml-2 inline-block size-[1.05em] translate-y-[0.16em] align-baseline sm:ml-3" />
            , AI that
          </span>
          <br />
          <span className="text-coral">
            <RotatingPhrase phrases={PHRASES} />
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/55">
          Your own AI headhunter. It finds jobs you&rsquo;d actually get and writes each application from your real resume. You
          approve every one.
        </p>

        <div className="mt-10 w-full">
          {open ? (
            <div className="mx-auto flex w-full max-w-[26rem] flex-col items-center gap-3">
              <Link href="/auth/login" className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-coral text-base font-medium text-white hover:bg-rose">
                Get your headhunter <ArrowRight className="size-4" aria-hidden />
              </Link>
              <span className="text-sm text-white/50">Sign in with your Hello Minds account</span>
            </div>
          ) : (
            <WaitlistForm referral={one(sp.ref)} source={one(sp.utm_source)} appUrl={mindsConfig.appUrl} verify={codeSignupAvailable()} />
          )}
        </div>
        {!open && waiting >= SHOW_WAITLIST_FROM && (
          <p className="mt-5 text-sm text-white/45">{waiting.toLocaleString("en")} people are already waiting</p>
        )}
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
              Upload your resume and answer a few questions. When you ask, it searches, picks the jobs you&rsquo;d actually win, and
              writes your application for each one.
            </p>
          </div>
          <div className="mx-auto mt-14 max-w-[884px]" aria-hidden>
            <WideArt />
          </div>
          <ol className="mx-auto mt-16 grid max-w-5xl gap-10 text-left sm:grid-cols-3">
            {STEPS.map((st, i) => (
              <li key={st.title}>
                <span className="font-display text-sm font-medium text-coral">0{i + 1}</span>
                <p className="font-display mt-2 text-xl font-medium text-white">{st.title}</p>
                <p className="mt-2 leading-relaxed text-white/55">{st.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* The product in numbers, all taken from how it actually works */}
        <section className="bg-night px-[6%] py-20">
          <dl className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {FACTS.map((f) => (
              <div key={f.label}>
                <dt className="font-display text-4xl font-medium text-white sm:text-5xl">{f.n}</dt>
                <dd className="mt-3 max-w-[16rem] leading-relaxed text-white/55">{f.label}</dd>
              </div>
            ))}
          </dl>
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
              <h2 className="font-display text-3xl font-medium tracking-[-0.01em] sm:text-[2.5rem] sm:leading-[1.15]">Learn more about Career Ninja</h2>
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

        {/* Straight answers */}
        <section id="faq" className="scroll-mt-15 bg-night-2 px-[6%] py-28">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display text-center text-3xl font-medium tracking-[-0.01em] sm:text-[2.5rem]">Questions, answered</h2>
            <div className="mt-12 divide-y divide-white/[0.08]">
              {FAQ.map((f) => (
                <details key={f.q} className="group py-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium text-white">
                    {f.q}
                    <ChevronRight className="size-5 shrink-0 text-white/40 transition-transform group-open:rotate-90" aria-hidden />
                  </summary>
                  <p className="mt-3 max-w-2xl leading-relaxed text-white/60">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Last screen, with the footer at its foot */}
        <section className="flex min-h-svh flex-col bg-night px-[6%] pt-15">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Ninja className="size-28" />
            <h2 className="font-display mt-6 text-3xl font-medium tracking-[-0.01em] sm:text-[2.5rem]">Stop scrolling job boards.</h2>
            <p className="mt-3 text-lg text-white/55">Let your headhunter bring the right ones to you.</p>
            <a
              href={action.href}
              className="mt-8 inline-flex h-12 w-64 items-center justify-center rounded-full bg-coral text-base font-medium text-white transition-colors hover:bg-rose"
            >
              {action.label}
            </a>
          </div>
          <footer className="flex flex-col items-center gap-4 py-8 text-sm text-white/45 sm:flex-row sm:justify-between">
            <span>© 2026 Career Ninja</span>
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
