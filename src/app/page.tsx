import Link from "next/link";
import { redirect } from "next/navigation";
import { count } from "drizzle-orm";
import {
  ArrowDown,
  ArrowRight,
  Brain,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Compass,
  FileText,
  Hand,
  Puzzle,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Mark, Ninja, type Mood } from "@/components/brand";
import { AnswersMock, CardMock, ExtensionMock, FrontMock, ProfilesPanels, ProgressMock } from "@/components/landing-art";
import { LandingHeader } from "@/components/landing-header";
import { RotatingPhrase } from "@/components/rotating-phrase";
import { WaitlistForm } from "@/components/waitlist-form";
import { db, schema } from "@/db";
import { codeSignupAvailable } from "@/lib/email";
import { launchMode } from "@/lib/launch";
import { mindsConfig } from "@/lib/minds/config";
import { MAX_POSTING_AGE_DAYS, MAX_JOBS_PER_SEARCH, MIN_JOBS_PER_SEARCH } from "@/lib/preferences";
import { getCurrentUser } from "@/lib/session";

const LOGIN_ERRORS: Record<string, string> = {
  denied: "Sign-in was cancelled. You can try again whenever you're ready.",
  expired: "Sign-in took too long. Please try again.",
  state: "Something went wrong with sign-in. Please try again.",
  exchange: "Hello Minds couldn't complete sign-in. Please try again.",
  config: "Sign-in is temporarily unavailable. Please try again later.",
};

const PHRASES = ["finds jobs you'd win", "writes your applications", "fills in the forms", "never makes things up"];

// Everything below is true of the product today; numbers come from the same code the app uses.

// Show the live waitlist size once it's big enough to help rather than hurt.
const SHOW_WAITLIST_FROM = 50;

const STEPS: { icon: typeof Search; mood: Mood; title: string; body: string }[] = [
  { icon: UserRound, mood: "happy", title: "Sign in with Hello Minds", body: "One click creates your own headhunter agent. It belongs to you, not to us, and only runs when you ask." },
  { icon: FileText, mood: "thinking", title: "Resume and preferences", body: "Upload your resume and answer a few questions: roles, country, remote or not, level, the least you'd accept." },
  { icon: Search, mood: "searching", title: "Search when you want", body: "Press Find jobs and watch it work. Each job arrives the moment it passes every check, so you can start while it keeps looking." },
  { icon: ShieldCheck, mood: "excited", title: "Every job is checked", body: `On the employer's own site, open today, posted in the last ${MAX_POSTING_AGE_DAYS} days, hireable from your country, pay not below your floor, and a real fit for your resume.` },
  { icon: Hand, mood: "surprised", title: "Reveal and swipe", body: "Jobs come as cards. Reveal one, swipe right to keep it, left to pass. Kept jobs line up in your pipeline from To apply to Offer." },
  { icon: Puzzle, mood: "love", title: "Apply with one click", body: "The Chrome extension opens each form, fills in your details, cover letter and answers, and waits for you to press Submit." },
];

const RULES = [
  "On the company's own careers page or job system, never a job-board copy",
  "Seen open today, and checked again by the app before it reaches you",
  `Posted within the last ${MAX_POSTING_AGE_DAYS} days`,
  "You can apply from your country, by the posting's own words",
  "Pay isn't clearly below the floor you set",
  "You meet most of the must-haves; missing any caps the match score",
  "Not a repeat, even under a different link or title",
  "Every fact in the application is a line from your resume",
];

const FACTS = [
  { n: `${MIN_JOBS_PER_SEARCH}–${MAX_JOBS_PER_SEARCH}`, label: "checked jobs per search. You choose, and it stops when it has them" },
  { n: `${RULES.length}`, label: "checks every job must pass before you see it" },
  { n: "0", label: "claims in your applications without a line in your resume behind them" },
  { n: "1", label: "click to fill a whole application form. You press Submit" },
];

// What job hunting feels like today, and what changes.
const PAINS = [
  { pain: "Hours scrolling boards full of reposts and jobs that closed weeks ago.", gain: "You see only jobs checked open today, on the employer's own site." },
  { pain: "\"Remote\" that turns out to mean one country, found after you've applied.", gain: "Every posting's own eligibility line is read before it reaches you." },
  { pain: "Rewriting the same cover letter and the same twenty form answers, again.", gain: "Written once from your resume, answered once about you, filled in every time." },
];

const MOODS: Mood[] = ["happy", "searching", "surprised", "love", "thinking", "excited", "sleeping", "sad"];

const FAQ = [
  {
    q: "Does it apply for me?",
    a: "Almost. It finds the job, writes the application, and the Chrome extension fills in the whole form. You read it and press Submit yourself. Nothing is ever sent without you.",
  },
  {
    q: "How long does a search take?",
    a: "Usually one to two hours for a handful of jobs, because each one is opened and checked properly. You don't need to wait: jobs appear as they're found, and you get an email when it's done.",
  },
  {
    q: "What is the second agent for?",
    a: "Application forms ask things only you know: notice period, relocation, years with a tool. Your personal agent answers those from your resume and details, you approve once, and it learns. The headhunter never sees your personal answers.",
  },
  {
    q: "Which jobs and countries does it cover?",
    a: "Any field, any country. You choose on-site, hybrid or remote, job type, seniority, a pay floor, companies to avoid, and whether you need visa sponsorship. It starts from the job sites people in your country actually use, then verifies on the employer's own page.",
  },
  {
    q: "Will it make things up about me?",
    a: "No. Every claim in a cover letter or answer must quote a line from your resume, and the app checks it. If it can't, the job is refused before you see it. Answers it doesn't know come to you instead of being guessed.",
  },
  {
    q: "What happens to my resume?",
    a: "It's used only to find and write for your jobs, and is shared only with your own agents. You can delete your account, resume and every job in one step from Settings.",
  },
];

const LEARN = [
  { icon: Compass, title: "Questions and answers", body: "Cost, countries, privacy, and what it will and won't do for you.", href: "#faq" },
  { icon: Shield, title: "Your privacy", body: "What we store, who sees it, and how to delete everything in one step.", href: "/privacy" },
  { icon: Sparkles, title: "Built on Hello Minds", body: "Your agents are AI Minds you own, running on the Hello Minds platform.", href: "https://hellominds.ai" },
];

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-3xl font-medium tracking-[-0.01em] sm:text-[2.5rem] sm:leading-[1.15]">{children}</h2>;
}

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
          Your own AI headhunter. It finds real, open jobs you&rsquo;d actually get, writes each application from your resume,
          and fills in the forms. You approve every one.
        </p>

        <div className="mt-10 w-full">
          {open ? (
            <div className="mx-auto flex w-full max-w-[26rem] flex-col items-center gap-3">
              <Link href="/auth/login" className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-coral text-base font-medium text-white hover:bg-rose">
                Get your headhunter <ArrowRight className="size-4" aria-hidden />
              </Link>
              <span className="text-sm text-white/50">Sign in with your Hello Minds account.</span>
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
          href="#how"
          className="absolute bottom-8 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/[0.08] px-4 py-2.5 text-sm text-white/90 hover:bg-white/[0.14]"
        >
          How it works <ArrowDown className="size-4" aria-hidden />
        </a>
      </section>

      <main>
        {/* The problem, and what changes */}
        <section className="bg-night px-[6%] py-20 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <H2>Job hunting is a second job. It shouldn&rsquo;t be.</H2>
          </div>
          <ul className="mx-auto mt-12 grid max-w-6xl gap-6 md:grid-cols-3">
            {PAINS.map((p) => (
              <li key={p.pain} className="rounded-3xl bg-surface p-7">
                <p className="text-lg leading-relaxed text-white/50 line-through decoration-white/25">{p.pain}</p>
                <p className="mt-4 flex gap-2.5 text-lg leading-relaxed text-white">
                  <CheckCircle2 className="mt-1 size-5 shrink-0 text-coral" aria-hidden /> {p.gain}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-15 bg-night-2 px-[6%] py-24 sm:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <H2>How it works</H2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-white/55">
              Six steps, and you only do three of them: set it up, swipe, press Submit.
            </p>
          </div>
          <ol className="mx-auto mt-16 grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((st, i) => (
              <li key={st.title} className="relative rounded-3xl bg-surface p-7">
                <div className="flex items-start justify-between">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-coral/15 text-rose">
                    <st.icon className="size-5" aria-hidden />
                  </span>
                  <Ninja mood={st.mood} className="size-14 -mt-2 -mr-1" />
                </div>
                <p className="font-display mt-5 text-sm font-medium text-coral">0{i + 1}</p>
                <p className="font-display mt-1 text-xl font-medium text-white">{st.title}</p>
                <p className="mt-2 leading-relaxed text-white/55">{st.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* The cards */}
        <section id="cards" className="bg-night px-[6%] py-24 sm:py-32">
          <div className="mx-auto grid max-w-6xl items-center gap-14 md:grid-cols-2 md:gap-16">
            <div>
              <H2>Jobs arrive as cards, one at a time</H2>
              <p className="mt-4 max-w-[36rem] text-lg leading-relaxed text-white/55">
                Each card arrives face down. Reveal it and you get what matters first: the title and company, the pay, whether you
                can work it from where you live, and how many of the requirements you actually meet. Then why you fit, what to
                watch out for, and what the job really is. Swipe right to keep it, left to pass.
              </p>
              <p className="mt-4 max-w-[36rem] text-lg leading-relaxed text-white/55">
                No match percentages pulled from thin air. &ldquo;You meet 3 of 4&rdquo; is counted from the posting&rsquo;s own
                requirements against your resume.
              </p>
            </div>
            <div className="relative mx-auto w-full max-w-[460px]" aria-hidden>
              <div className="absolute -left-10 top-10 hidden w-[320px] -rotate-6 opacity-50 lg:block">
                <FrontMock />
              </div>
              <div className="relative">
                <CardMock />
              </div>
            </div>
          </div>
        </section>

        {/* Live search */}
        <section id="live" className="bg-night-2 px-[6%] py-24 sm:py-32">
          <div className="mx-auto grid max-w-6xl items-center gap-14 md:grid-cols-2 md:gap-16">
            <div className="flex justify-center md:order-2" aria-hidden>
              <ProgressMock />
            </div>
            <div className="md:order-1">
              <H2>Watch it work, or walk away</H2>
              <p className="mt-4 max-w-[36rem] text-lg leading-relaxed text-white/55">
                A search runs only when you ask. You see what it&rsquo;s doing, how many it has found, and what it has spent.
                Jobs land on your page as they&rsquo;re checked, so you can swipe while it keeps looking. It stops by itself when it
                has your number or runs out of good leads, and emails you when it&rsquo;s done.
              </p>
            </div>
          </div>
        </section>

        {/* Two agents */}
        <section id="agents" className="bg-night px-[6%] py-24 sm:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <H2>Two agents, each with one job</H2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-white/55">
              They never talk to each other. The app sits in the middle and passes each one only what it needs.
            </p>
          </div>
          <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-2">
            <div className="rounded-3xl bg-surface p-8">
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-coral/15 text-rose">
                  <Briefcase className="size-5" aria-hidden />
                </span>
                <Ninja mood="searching" className="size-16" />
              </div>
              <p className="font-display mt-5 text-2xl font-medium text-white">Your headhunter</p>
              <p className="mt-1 text-sm text-white/45">Knows the job market and your resume</p>
              <ul className="mt-5 space-y-2.5 text-white/70">
                {["Searches the sites people in your country use, then verifies on the employer's own page", "Checks every rule before a job reaches you", "Writes the cover letter and the job-specific answers, quoting only your resume", "Copies the questions off each application form"].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <CheckCircle2 className="mt-1 size-4 shrink-0 text-coral" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl bg-surface p-8">
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-coral/15 text-rose">
                  <Brain className="size-5" aria-hidden />
                </span>
                <Ninja mood="thinking" className="size-16" />
              </div>
              <p className="font-display mt-5 text-2xl font-medium text-white">Your personal agent</p>
              <p className="mt-1 text-sm text-white/45">Knows you, and nothing else</p>
              <ul className="mt-5 space-y-2.5 text-white/70">
                {["Answers the questions forms ask about you: notice period, relocation, years with a tool", "Only from your resume, your details and what you've told it; never a guess", "Says \"I don't know\" and hands the question to you when it has nothing to go on", "Learns every answer you give, so fewer questions reach you each time"].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <CheckCircle2 className="mt-1 size-4 shrink-0 text-coral" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Answers */}
        <section id="answers" className="bg-night-2 px-[6%] py-24 sm:py-32">
          <div className="mx-auto grid max-w-6xl items-center gap-14 md:grid-cols-2 md:gap-16">
            <div className="flex justify-center" aria-hidden>
              <AnswersMock />
            </div>
            <div>
              <H2>Check once, never type it again</H2>
              <p className="mt-4 max-w-[36rem] text-lg leading-relaxed text-white/55">
                After a search, your personal agent&rsquo;s answers wait for a quick look: approve, fix, or answer the ones it
                couldn&rsquo;t. Everything you approve is saved and filled in automatically on every form that asks the same thing,
                however it&rsquo;s worded.
              </p>
            </div>
          </div>
        </section>

        {/* Extension */}
        <section id="extension" className="bg-night px-[6%] py-24 sm:py-32">
          <div className="mx-auto grid max-w-6xl items-center gap-14 md:grid-cols-2 md:gap-16">
            <div>
              <H2>One click fills the whole form</H2>
              <p className="mt-4 max-w-[36rem] text-lg leading-relaxed text-white/55">
                The Chrome extension opens each job you kept, on Greenhouse, Lever or Ashby, and fills in your details, your
                resume, the cover letter, the headhunter&rsquo;s answers and your saved answers. Anything it doesn&rsquo;t know it
                leaves highlighted for you, and learns what you type. You press Submit.
              </p>
            </div>
            <div className="flex justify-center" aria-hidden>
              <ExtensionMock />
            </div>
          </div>
        </section>

        {/* Rules */}
        <section id="rules" className="bg-night-2 px-[6%] py-24 sm:py-32">
          <div className="mx-auto grid max-w-6xl items-start gap-12 md:grid-cols-[1fr_1.2fr]">
            <div>
              <H2>What every job must pass</H2>
              <p className="mt-4 max-w-sm text-lg leading-relaxed text-white/55">
                Most of what a headhunter finds fails these. You only see what passes, and the app enforces every one, not just the
                agent.
              </p>
            </div>
            <ul className="divide-y divide-white/[0.08]">
              {RULES.map((r) => (
                <li key={r} className="flex items-start gap-4 py-4 text-lg text-white/80">
                  <ShieldCheck className="mt-1 size-5 shrink-0 text-coral" aria-hidden /> {r}
                </li>
              ))}
            </ul>
          </div>
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

        {/* Several headhunters */}
        <section className="flex items-center bg-night-2 px-[6%] py-24 sm:py-32">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-14 md:grid-cols-2 md:gap-16">
            <div className="flex justify-center" aria-hidden>
              <div className="w-full origin-center md:scale-110">
                <ProfilesPanels />
              </div>
            </div>
            <div>
              <H2>One headhunter for every kind of job you want</H2>
              <p className="mt-4 max-w-[36rem] text-lg leading-relaxed text-white/55">
                Open to design and product roles? Give each its own headhunter with its own resume, filters and shortlist, so
                neither search waters down the other. Your personal agent and your saved answers are shared by all of them.
              </p>
            </div>
          </div>
        </section>

        {/* Mochi */}
        <section className="bg-night px-[6%] py-16">
          <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-center gap-6" aria-hidden>
            {MOODS.map((m) => (
              <Ninja key={m} mood={m} className="size-16 sm:size-20" />
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-white/40">Mochi, your headhunter&rsquo;s face. It searches, thinks, sleeps between searches, and gets excited when it finds you something.</p>
        </section>

        {/* Learn more */}
        <section className="bg-night-2 px-[6%] py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[1fr_1.4fr]">
            <div>
              <H2>Learn more about Career Ninja</H2>
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
        <section id="faq" className="scroll-mt-15 bg-night px-[6%] py-28">
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
        <section className="flex min-h-svh flex-col bg-night-2 px-[6%] pt-15">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Ninja mood="love" className="size-28" />
            <h2 className="font-display mt-6 text-3xl font-medium tracking-[-0.01em] sm:text-[2.5rem]">Stop scrolling job boards.</h2>
            <p className="mt-3 text-lg text-white/55">Let your headhunter bring the right ones to you.</p>
            <a
              href={action.href}
              className="mt-8 inline-flex h-12 w-64 items-center justify-center rounded-full bg-coral text-base font-medium text-white transition-colors hover:bg-rose"
            >
              {open ? "Get your headhunter" : action.label}
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
