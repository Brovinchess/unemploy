import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDown, ArrowRight, BriefcaseBusiness } from "lucide-react";
import { ControlArt, PackArt, ProfilesArt, ShortlistArt, WideArt } from "@/components/landing-art";
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

const SECTIONS = [
  {
    title: "Finds the few jobs worth your time",
    body: "Tell it where you want to work and what you're after. Every morning it brings you the best matches, ranked by how well you fit, with an honest note on why.",
    art: <ShortlistArt />,
  },
  {
    title: "Writes every application from your real experience",
    body: "Each job comes with a cover letter and answers to its questions. Every claim is traced back to a line in your resume, so nothing is ever made up.",
    art: <PackArt />,
  },
  {
    title: "Stay in control of what gets sent",
    body: "Nothing goes out without you. Apply, save or skip with one tap. Every skip teaches your headhunter what you don't want, and you can pause it any time.",
    art: <ControlArt />,
  },
  {
    title: "One headhunter for every kind of job you want",
    body: "Looking for design and product roles? Give each its own headhunter, resume and shortlist. In any country, on-site, hybrid or remote.",
    art: <ProfilesArt />,
  },
];

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function Home({ searchParams }: PageProps<"/">) {
  const user = await getCurrentUser();
  if (user) redirect("/start");
  const sp = await searchParams;
  const error = LOGIN_ERRORS[one(sp.login_error) ?? ""];
  const deleted = sp.deleted === "1";
  const open = launchMode === "open";

  const cta = open ? (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3">
      <Link href="/auth/login" className="btn btn-accent h-13 w-full rounded-2xl text-base">
        Get your headhunter <ArrowRight className="size-4" aria-hidden />
      </Link>
      <span className="text-sm text-white/50">Sign in with your Hello Minds account</span>
    </div>
  ) : (
    <WaitlistForm referral={one(sp.ref)} source={one(sp.utm_source)} appUrl={mindsConfig.appUrl} />
  );

  return (
    <div id="top" className="flex flex-1 flex-col bg-night text-white">
      <header className="sticky top-0 z-30 bg-night/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="font-display text-lg font-semibold tracking-tight text-white">
            unemploy<span className="text-coral">.</span>
          </Link>
          {open ? (
            <Link href="/auth/login" className="rounded-full bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-rose">
              Log in
            </Link>
          ) : (
            <a href="#top" className="rounded-full bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-rose">
              Join the waitlist
            </a>
          )}
        </div>
      </header>

      {/* First screen */}
      <section className="relative flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center px-5 pb-28 text-center">
        <h1 className="font-display text-[2.6rem] font-medium leading-[1.1] tracking-[-0.01em] sm:text-[4rem]">
          <span className="whitespace-nowrap">
            Unemploy
            <span className="ml-2 inline-flex size-[0.95em] translate-y-[0.1em] items-center justify-center rounded-full bg-coral align-baseline shadow-[0_0_40px_4px_rgba(201,101,103,0.35)] sm:ml-3">
              <BriefcaseBusiness className="size-[0.48em] text-white" strokeWidth={2} aria-hidden />
            </span>
            , AI that
          </span>
          <br />
          <span className="text-coral">
            <RotatingPhrase phrases={PHRASES} />
          </span>
        </h1>

        <div className="mt-14 w-full">{cta}</div>
        {error && <p className="mt-6 rounded-xl bg-coral/15 px-4 py-3 text-sm text-coral">{error}</p>}
        {deleted && <p className="mt-6 text-sm text-white/60">Your account and data have been deleted.</p>}

        <a
          href="#learn-more"
          className="absolute bottom-8 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/[0.08] px-4 py-2.5 text-sm text-white/90 hover:bg-white/[0.14]"
        >
          Learn more <ArrowDown className="size-4" aria-hidden />
        </a>
      </section>

      <main id="learn-more">
        {/* Centered statement with one wide picture, like Muse's first section */}
        <section className="mx-auto max-w-7xl px-5 pt-24 pb-16 sm:px-8 sm:pt-32">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-3xl font-medium tracking-[-0.01em] sm:text-[2.5rem] sm:leading-[1.15]">
              Your own headhunter, working in the background
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/55">
              Upload your resume and answer a few questions. Your headhunter searches every day, picks the jobs you&rsquo;d
              actually win, and writes your application for each one.
            </p>
          </div>
          <div className="mx-auto mt-14 max-w-5xl" aria-hidden>
            <WideArt />
          </div>
        </section>

        {/* Alternating statements with a large square picture */}
        {SECTIONS.map((s, i) => (
          <section key={s.title} className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="grid items-center gap-10 md:grid-cols-2 md:gap-20">
              <div className={i % 2 ? "md:order-2" : ""} aria-hidden>
                {s.art}
              </div>
              <div className={i % 2 ? "md:order-1" : ""}>
                <h3 className="font-display max-w-md text-3xl font-medium tracking-[-0.01em] sm:text-[2.5rem] sm:leading-[1.15]">{s.title}</h3>
                <p className="mt-5 max-w-md text-lg leading-relaxed text-white/55">{s.body}</p>
              </div>
            </div>
          </section>
        ))}

        <section className="px-5 py-28 text-center sm:py-36">
          <h2 className="font-display mx-auto max-w-2xl text-3xl font-medium tracking-[-0.01em] sm:text-[2.5rem] sm:leading-[1.15]">
            Ready to stop applying blindly?
          </h2>
          <div className="mt-10">{cta}</div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-8 text-sm text-white/45 sm:px-8">
          <span>© Unemploy</span>
          <span className="flex gap-6">
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <span>Powered by Hello Minds</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
