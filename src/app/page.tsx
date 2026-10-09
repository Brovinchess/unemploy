import Link from "next/link";
import { redirect } from "next/navigation";
import { count } from "drizzle-orm";
import {
  ArrowRight,
  Brain,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  FileText,
  Hand,
  Puzzle,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Ninja, type Mood } from "@/components/brand";
import { CardMock, ExtensionMock, FrontMock } from "@/components/landing-art";
import { LandingHeader } from "@/components/landing-header";
import { RotatingPhrase } from "@/components/rotating-phrase";
import { WaitlistForm } from "@/components/waitlist-form";
import { db, schema } from "@/db";
import { codeSignupAvailable } from "@/lib/email";
import { launchMode } from "@/lib/launch";
import { mindsConfig } from "@/lib/minds/config";
import { MAX_POSTING_AGE_DAYS } from "@/lib/preferences";
import { getCurrentUser } from "@/lib/session";

const LOGIN_ERRORS: Record<string, string> = {
  denied: "Sign-in was cancelled. You can try again whenever you're ready.",
  expired: "Sign-in took too long. Please try again.",
  state: "Something went wrong with sign-in. Please try again.",
  exchange: "Hello Minds couldn't complete sign-in. Please try again.",
  config: "Sign-in is temporarily unavailable. Please try again later.",
};

const PHRASES = ["finds jobs you'd actually get", "writes every application", "fills in the forms", "never makes things up"];

// Everything below is true of the product today; numbers come from the same code the app uses.

// Show the live waitlist size once it's big enough to help rather than hurt.
const SHOW_WAITLIST_FROM = 50;

const STEPS: { icon: typeof Search; mood: Mood; title: string; body: string }[] = [
  { icon: UserRound, mood: "happy", title: "Sign in, get your headhunter", body: "One click creates an agent that works only for you. It belongs to you, not to us, and runs only when you ask." },
  { icon: FileText, mood: "thinking", title: "Tell it what you want", body: "Upload your resume and answer a few questions: roles, where, remote or not, level, the least you'd accept." },
  { icon: Search, mood: "searching", title: "Ask, and it searches", body: "Press Find jobs. Each job lands on your page the moment it passes every check, so you can start while it keeps looking." },
  { icon: ShieldCheck, mood: "excited", title: "Open today, on the employer's site", body: `On the employer's own site, open today, posted in the last ${MAX_POSTING_AGE_DAYS} days, hireable from your country, pay not below your floor, and a real fit for your resume.` },
  { icon: Hand, mood: "surprised", title: "Swipe right to apply", body: "Jobs come as cards. Reveal one, swipe right to keep it, left to pass. Kept jobs line up from To apply to Offer." },
  { icon: Puzzle, mood: "love", title: "The form fills itself", body: "The Chrome extension opens each application, fills in your details, cover letter and answers, and waits for you to press Submit." },
];



// What job hunting feels like today, and what changes.
const PAINS = [
  { pain: "Hours scrolling boards full of reposts and jobs that closed weeks ago.", gain: "You see only jobs checked open today, on the employer's own site." },
  { pain: "\"Remote\" that turns out to mean one country, found after you've applied.", gain: "Every posting's own eligibility line is read before it reaches you." },
  { pain: "Rewriting the same cover letter and the same twenty form answers, again.", gain: "Written once from your resume, answered once about you, filled in every time." },
];



const FAQ = [
  {
    q: "Does it apply for me?",
    a: "Almost. It finds the job, writes the application, and the Chrome extension fills in the whole form. You read it and press Submit yourself. Nothing is ever sent without you.",
  },
  {
    q: "What is the second agent for?",
    a: "Application forms ask things only you know: notice period, relocation, years with a tool. Your personal agent answers those from your resume and details, you approve once, and it learns.",
  },
  {
    q: "Will it make things up about me?",
    a: "No. Every claim in a cover letter or answer must quote a line from your resume, and the app checks it. Answers it doesn't know come to you instead of being guessed.",
  },
  {
    q: "What happens to my resume?",
    a: "It's used only to find and write for your jobs, and is shared only with your own agents. You can delete your account, resume and every job in one step from Settings.",
  },
];

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-[1.75rem] font-medium leading-[1.15] tracking-[-0.01em] sm:text-[2.25rem]">{children}</h2>;
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  // Signed-in people go to the app, unless they want to look at the landing page itself.
  if (user && !("preview" in sp)) redirect("/start");
  const error = LOGIN_ERRORS[one(sp.login_error) ?? ""];
  const deleted = sp.deleted === "1";
  const open = launchMode === "open";
  const action = open ? { label: "Log in", href: "/auth/login" } : { label: "Join the waitlist", href: "#top" };
  const [{ n: waiting }] = open ? [{ n: 0 }] : await db.select({ n: count() }).from(schema.waitlist);

  return (
    <div id="top" className="flex flex-1 flex-col bg-night text-white">
      <LandingHeader action={action} />

      {/* First screen */}
      <section className="relative px-[6%] pb-16 pt-24 sm:pb-20 sm:pt-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[1.1fr_0.9fr] md:gap-16">
          <div className="text-center md:text-left">
            <Ninja mood="happy" className="float mx-auto size-20 md:mx-0" />
            <h1 className="font-display mt-6 text-[2.4rem] font-medium leading-[1.08] tracking-[-0.01em] sm:text-[3.5rem]">
              Stop scrolling job boards.
              <br />
              <span className="text-white/70">Your own headhunter</span>{" "}
              <span className="text-coral">
                <RotatingPhrase phrases={PHRASES} />
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-white/55 md:mx-0">
              It finds real, open jobs you&rsquo;d get, writes each application from your resume, and fills in the form. You read
              it and press Submit.
            </p>

            <div className="mt-8">
              {open ? (
                <div className="flex w-full max-w-[26rem] flex-col items-center gap-3 max-md:mx-auto md:items-start">
                  <Link href="/auth/login" className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-coral text-base font-medium text-white hover:bg-rose sm:w-auto sm:px-7">
                    Get my headhunter <ArrowRight className="size-4" aria-hidden />
                  </Link>
                  <span className="text-sm text-white/50">Free to start. Sign in with Hello Minds.</span>
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
          </div>
          <div className="relative mx-auto hidden w-full max-w-[420px] md:block" aria-hidden>
            <div className="absolute -left-8 top-8 hidden w-[300px] -rotate-6 opacity-40 lg:block">
              <FrontMock />
            </div>
            <div className="relative">
              <CardMock />
            </div>
          </div>
        </div>
      </section>

      <main>
        {/* Partners */}
        <section className="border-y border-white/[0.06] bg-night px-[6%] py-8">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 sm:flex-row sm:gap-10">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/40">In partnership with</p>
            <div className="flex items-center gap-8 sm:gap-12">
              <a href="https://hellominds.ai" target="_blank" rel="noopener noreferrer" className="opacity-80 transition-opacity hover:opacity-100" aria-label="Minds by Animoca Brands">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/partners/minds.svg" alt="Minds" className="h-7 w-auto brightness-0 invert" />
              </a>
              <a href="https://www.animocabrands.com" target="_blank" rel="noopener noreferrer" className="opacity-80 transition-opacity hover:opacity-100" aria-label="Animoca Brands">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/partners/animoca.svg" alt="Animoca Brands" className="h-9 w-auto brightness-0 invert" />
              </a>
            </div>
          </div>
        </section>

        {/* The problem, and what changes */}
        <section className="bg-night px-[6%] py-16 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <H2>Job hunting is a second job. It shouldn&rsquo;t be.</H2>
          </div>
          <ul className="mx-auto mt-10 grid max-w-6xl gap-5 md:grid-cols-3">
            {PAINS.map((p) => (
              <li key={p.pain} className="rounded-3xl bg-surface p-6">
                <p className="text-base leading-relaxed text-white/50 line-through decoration-white/25">{p.pain}</p>
                <p className="mt-4 flex gap-2.5 text-base leading-relaxed text-white">
                  <CheckCircle2 className="mt-1 size-5 shrink-0 text-coral" aria-hidden /> {p.gain}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-15 bg-night-2 px-[6%] py-16 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <H2>From resume to Submit</H2>
            <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-white/55">
              Six steps. You do three: set it up, swipe, press Submit.
            </p>
          </div>
          <ol className="mx-auto mt-12 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((st, i) => (
              <li key={st.title} className="relative rounded-3xl bg-surface p-5 sm:p-6">
                <div className="flex items-start justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-coral/15 text-rose">
                    <st.icon className="size-[18px]" aria-hidden />
                  </span>
                  <Ninja mood={st.mood} className="-mt-1 hidden size-11 sm:block" />
                </div>
                <p className="font-display mt-3 text-xs font-medium text-coral sm:mt-4">0{i + 1}</p>
                <p className="font-display mt-1 text-lg font-medium text-white">{st.title}</p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-white/55">{st.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* The cards */}
        <section id="cards" className="bg-night px-[6%] py-16 sm:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-14">
            <div>
              <H2>One job at a time, face down</H2>
              <p className="mt-4 max-w-[36rem] text-base leading-relaxed text-white/55">
                Reveal a card and the big questions are answered first: what the job is, what it pays, whether you can work it
                from where you live, and how many requirements you meet. Swipe right to keep it, left to pass.
              </p>
              <p className="mt-4 max-w-[36rem] text-base leading-relaxed text-white/55">
                No match percentages pulled from thin air. &ldquo;You meet 3 of 4&rdquo; is counted from the posting&rsquo;s own
                requirements against your resume.
              </p>
            </div>
            <div className="mx-auto w-full max-w-[360px]" aria-hidden>
              <FrontMock />
            </div>
          </div>
        </section>

        {/* Live search */}
        {/* Two agents */}
        <section id="agents" className="bg-night px-[6%] py-16 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <H2>One finds jobs. One knows you.</H2>
            <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-white/55">
              Two agents that never talk to each other. The app sits in the middle and passes each one only what it needs.
            </p>
          </div>
          <div className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-2">
            <div className="rounded-3xl bg-surface p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-coral/15 text-rose">
                  <Briefcase className="size-5" aria-hidden />
                </span>
                <Ninja mood="searching" className="size-16" />
              </div>
              <p className="font-display mt-4 text-xl font-medium text-white">Your headhunter</p>
              <p className="mt-1 text-sm text-white/45">Knows the job market and your resume</p>
              <ul className="mt-4 space-y-2 text-[15px] text-white/70">
                {["Searches the web and employers' own job pages, then checks each posting is real and open", "Checks every rule before a job reaches you", "Writes the cover letter and the job-specific answers, quoting only your resume", "Copies the questions off each application form"].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <CheckCircle2 className="mt-1 size-4 shrink-0 text-coral" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl bg-surface p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-coral/15 text-rose">
                  <Brain className="size-5" aria-hidden />
                </span>
                <Ninja mood="thinking" className="size-16" />
              </div>
              <p className="font-display mt-4 text-xl font-medium text-white">Your personal agent</p>
              <p className="mt-1 text-sm text-white/45">Knows you, and nothing else</p>
              <ul className="mt-4 space-y-2 text-[15px] text-white/70">
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
        <section id="extension" className="bg-night px-[6%] py-16 sm:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-14">
            <div>
              <H2>The form fills itself. You press Submit.</H2>
              <p className="mt-4 max-w-[36rem] text-base leading-relaxed text-white/55">
                The Chrome extension opens each job you kept and fills in your details, resume, cover letter and answers.
                Anything it doesn&rsquo;t know it highlights for you, and remembers what you type. Works on Greenhouse, Lever and
                Ashby.
              </p>
            </div>
            <div className="flex justify-center" aria-hidden>
              <ExtensionMock />
            </div>
          </div>
        </section>

        {/* Rules */}
        {/* Straight answers */}
        <section id="faq" className="scroll-mt-15 bg-night px-[6%] py-16 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display text-center text-[1.75rem] font-medium tracking-[-0.01em] sm:text-[2.25rem]">Is it really that simple?</h2>
            <div className="mt-8 divide-y divide-white/[0.08]">
              {FAQ.map((f) => (
                <details key={f.q} className="group py-5">
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
        <section className="flex flex-col bg-night-2 px-[6%] pt-20">
          <div className="flex flex-1 flex-col items-center justify-center pb-16 text-center">
            <Ninja mood="love" className="size-24" />
            <h2 className="font-display mt-5 text-[1.75rem] font-medium tracking-[-0.01em] sm:text-[2.25rem]">Your next job is already posted somewhere.</h2>
            <p className="mt-3 text-base text-white/55">Let your headhunter go and find it.</p>
            <a
              href={action.href}
              className="mt-8 inline-flex h-12 w-64 items-center justify-center rounded-full bg-coral text-base font-medium text-white transition-colors hover:bg-rose"
            >
              {open ? "Get my headhunter" : action.label}
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
              In partnership with <span className="font-medium text-white">Minds</span> by Animoca Brands
            </span>
          </footer>
        </section>
      </main>
    </div>
  );
}
