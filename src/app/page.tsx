import Link from "next/link";
import { redirect } from "next/navigation";
import { count } from "drizzle-orm";
import { ArrowRight, CheckCircle2, ChevronRight } from "lucide-react";
import { Ninja } from "@/components/brand";
import { CardMock, ExtensionMock, FrontMock } from "@/components/landing-art";
import { LandingHeader } from "@/components/landing-header";
import { WaitlistForm } from "@/components/waitlist-form";
import { db, schema } from "@/db";
import { codeSignupAvailable } from "@/lib/email";
import { launchMode } from "@/lib/launch";
import { mindsConfig } from "@/lib/minds/config";
import { FAQ, PAINS, STEPS, STORE_URL } from "@/lib/landing-copy";
import { getCurrentUser } from "@/lib/session";

const LOGIN_ERRORS: Record<string, string> = {
  denied: "Sign-in was cancelled. You can try again whenever you're ready.",
  expired: "Sign-in took too long. Please try again.",
  state: "Something went wrong with sign-in. Please try again.",
  exchange: "Hello Minds couldn't complete sign-in. Please try again.",
  config: "Sign-in is temporarily unavailable. Please try again later.",
};

// Everything below is true of the product today; numbers come from the same code the app uses.

// Show the live waitlist size once it's big enough to help rather than hurt.
const SHOW_WAITLIST_FROM = 50;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

// What search engines read about the site, the product and the questions people ask. Kept to
// facts the page itself states.
function structuredData() {
  const base = mindsConfig.appUrl;
  const org = { "@type": "Organization", "@id": `${base}/#org`, name: "Career Ninja", url: base, logo: `${base}/mochi.svg` };
  return {
    "@context": "https://schema.org",
    "@graph": [
      org,
      { "@type": "WebSite", "@id": `${base}/#site`, url: base, name: "Career Ninja", publisher: { "@id": `${base}/#org` } },
      {
        "@type": "SoftwareApplication",
        name: "Career Ninja",
        url: base,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, Chrome",
        description: "An AI headhunter that finds open jobs matching your resume, writes each application, and fills in the form through a Chrome extension. You press Submit.",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "First searches are free." },
        featureList: ["AI job search", "Job application autofill in Chrome", "Cover letters and form answers written from your resume", "Eligibility and posting-age checks", "Application tracker"],
        publisher: { "@id": `${base}/#org` },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };
}

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
  const loginHref = "/auth/login";
  const action = open ? { label: "Log in", href: loginHref } : { label: "Join the waitlist", href: "#top" };
  const [{ n: waiting }] = open ? [{ n: 0 }] : await db.select({ n: count() }).from(schema.waitlist);

  return (
    <div id="top" className="flex flex-1 flex-col bg-night text-white">
      <LandingHeader action={action} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()) }} />

      {/* First screen */}
      <section className="relative px-[6%] pb-16 pt-24 sm:pb-20 sm:pt-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[1.1fr_0.9fr] md:gap-16">
          <div className="text-center md:text-left">
            <Ninja mood="happy" className="float mx-auto size-20 md:mx-0" />
            <h1 className="font-display mt-6 text-[2.4rem] font-medium leading-[1.08] tracking-[-0.01em] sm:text-[3.5rem]">
              Stop scrolling job boards.
              <br />
              <span className="text-white/70">Your own AI headhunter</span> <span className="text-coral">writes every application.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-white/55 md:mx-0">
              It finds real, open jobs you&rsquo;d get, writes each application from your resume, and answers what the form
              asks. You read it and press Submit.
            </p>

            <div className="mt-8">
              {open ? (
                <div className="flex w-full max-w-[26rem] flex-col items-center gap-3 max-md:mx-auto md:items-start">
                  <a href={loginHref} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-coral text-base font-medium text-white hover:bg-rose sm:w-auto sm:px-7">
                    Get my headhunter <ArrowRight className="size-4" aria-hidden />
                  </a>
                  <span className="text-sm text-white/50">{sp.ref === "1" ? "A friend invited you. Sign in with Hello Minds; your first searches are free." : "Sign in with Hello Minds. Your first searches are free."}</span>
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
              Six steps. Three are yours: set it up, swipe, press Submit.
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
                from where you live, and how many requirements you meet. Swipe right to keep it, left to dismiss.
              </p>
              <p className="mt-4 max-w-[36rem] text-base leading-relaxed text-white/55">
                &ldquo;You meet 3 of 4&rdquo; is counted from the posting&rsquo;s own requirements against your resume. The card
                shows which ones you meet and which you don&rsquo;t.
              </p>
            </div>
            <div className="mx-auto w-full max-w-[360px]" aria-hidden>
              <FrontMock />
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
                Anything it doesn&rsquo;t know it highlights for you, and remembers what you type. Works on Greenhouse, Lever and Ashby.
              </p>
              <a
                href={STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-accent mt-6"
              >
                Add to Chrome
              </a>
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
            <h2 className="font-display text-center text-[1.75rem] font-medium tracking-[-0.01em] sm:text-[2.25rem]">Questions</h2>
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
