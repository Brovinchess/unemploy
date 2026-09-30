import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDown, ArrowRight, Bookmark, BriefcaseBusiness, ExternalLink, X } from "lucide-react";
import { CompanyMark, Logo } from "@/components/logo";
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

const PHRASES = [
  "finds jobs you'd win",
  "writes your applications",
  "works while you sleep",
  "never makes things up",
  "learns what you want",
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
      <Link href="/auth/login" className="btn btn-accent h-12 w-full rounded-2xl">
        Get your headhunter <ArrowRight className="size-4" aria-hidden />
      </Link>
      <span className="text-sm text-white/60">Sign in with your Hello Minds account</span>
    </div>
  ) : (
    <WaitlistForm referral={one(sp.ref)} source={one(sp.utm_source)} appUrl={mindsConfig.appUrl} />
  );

  return (
    <div className="flex flex-1 flex-col bg-surface">
      {/* First screen */}
      <section className="relative flex min-h-svh flex-col bg-ink text-white">
        <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo light />
          {open && (
            <Link href="/auth/login" className="btn btn-sm rounded-full bg-white px-4 text-ink hover:bg-white/90">
              Log in
            </Link>
          )}
        </header>

        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 pb-24 pt-8 text-center">
          <h1 className="font-display text-[2.5rem] font-bold leading-[1.1] tracking-tight sm:text-6xl">
            <span className="whitespace-nowrap">
              Unemploy
              <span className="ml-2 mr-0.5 inline-flex size-[0.9em] translate-y-[0.08em] items-center justify-center rounded-full bg-coral align-baseline sm:ml-3">
                <BriefcaseBusiness className="size-[0.5em] text-white" aria-hidden />
              </span>
              ,
            </span>{" "}
            your AI headhunter that
            <br />
            <span className="text-coral">
              <RotatingPhrase phrases={PHRASES} />
            </span>
          </h1>

          <div className="mt-12 w-full">{cta}</div>
          {error && <p className="mt-6 rounded-xl bg-coral-soft px-4 py-3 text-sm text-rose">{error}</p>}
          {deleted && <p className="mt-6 text-sm text-white/70">Your account and data have been deleted.</p>}
        </div>

        <a
          href="#learn-more"
          className="absolute bottom-8 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/90 hover:bg-white/15"
        >
          Learn more <ArrowDown className="size-4" aria-hidden />
        </a>
      </section>

      <main id="learn-more" className="flex-1">
        <Feature
          eyebrow="Your daily shortlist"
          title="A headhunter that searches every day, so you don't have to."
          body="Tell it where you want to work and what you're after. Every morning it brings you the few jobs worth your time, ranked by how well you fit, with an honest note on why."
          visual={<ShortlistVisual />}
        />
        <Feature
          flip
          eyebrow="Applications, written for you"
          title="Every job comes with a ready-to-send application."
          body="A cover letter and answers to the job's questions, written from your real experience. Every claim is traced back to a line in your resume, so nothing is made up."
          visual={<PackVisual />}
        />
        <Feature
          eyebrow="You stay in control"
          title="Nothing is sent without you."
          body="Apply, save or skip with one tap. Skips teach your headhunter what you don't want, and you can pause it any time."
          visual={<ControlVisual />}
        />
        <Feature
          flip
          eyebrow="Built for real job hunts"
          title="One headhunter for each kind of job you want."
          body="Looking for design and product roles? Give each its own headhunter, its own resume and its own shortlist, in any country, on-site, hybrid or remote."
          visual={<ProfilesVisual />}
        />

        <section className="bg-ink px-4 py-24 text-center text-white">
          <h2 className="font-display mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">
            Ready to stop applying blindly?
          </h2>
          <div className="mt-10">{cta}</div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-8 text-sm text-muted sm:px-6">
          <Logo />
          <span className="flex gap-5">
            <Link href="/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <span>Powered by Hello Minds</span>
          </span>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  eyebrow,
  title,
  body,
  visual,
  flip = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  visual: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <section className={flip ? "bg-canvas" : "bg-surface"}>
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 md:grid-cols-2 md:py-28">
        <div className={flip ? "md:order-2" : ""}>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="font-display mt-4 text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">{title}</h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">{body}</p>
        </div>
        <div className={flip ? "md:order-1" : ""} aria-hidden>
          {visual}
        </div>
      </div>
    </section>
  );
}

const shadow = "shadow-[0_24px_60px_-30px_rgba(49,68,85,0.35)]";

function ShortlistVisual() {
  const jobs = [
    { title: "Senior Product Designer", company: "Northwind Labs", tags: ["Hybrid", "Kuala Lumpur"], score: 94 },
    { title: "Product Designer, Payments", company: "Fernhill Bank", tags: ["On-site", "Full-time"], score: 89 },
    { title: "UX Designer", company: "Kitefly", tags: ["Remote", "Malaysia"], score: 83 },
  ];
  return (
    <div className={`card p-4 sm:p-5 ${shadow}`}>
      <div className="flex items-center justify-between px-1 pb-4">
        <p className="font-display font-bold text-ink">Today&rsquo;s shortlist</p>
        <span className="tag">3 new</span>
      </div>
      <ul className="space-y-2">
        {jobs.map((j, i) => (
          <li key={j.title} className={`flex items-center gap-3 rounded-xl border p-3 ${i === 0 ? "border-navy/20 bg-mist-soft/60" : "border-line"}`}>
            <CompanyMark name={j.company} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">{j.title}</p>
              <p className="truncate text-sm text-muted">{j.company}</p>
              <div className="mt-1.5 flex gap-1.5">
                {j.tags.map((t) => (
                  <span key={t} className="tag text-xs">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <span className="font-display text-lg font-bold text-coral">{j.score}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PackVisual() {
  return (
    <div className={`card p-5 ${shadow}`}>
      <p className="text-sm font-semibold text-ink">Cover letter</p>
      <p className="mt-2 leading-relaxed text-navy">
        Dear Northwind team, I&rsquo;m applying for the Senior Product Designer role.{" "}
        <mark className="rounded bg-coral-soft px-1 text-rose">I led the redesign of an app used by 1.2 million customers</mark>, and…
      </p>
      <div className="mt-5 rounded-xl bg-canvas p-4 text-sm">
        <p className="font-semibold text-ink">From your resume</p>
        <p className="mt-1 text-muted">&ldquo;Led the redesign of the PayLane mobile app used by 1.2 million customers.&rdquo;</p>
      </div>
    </div>
  );
}

function ControlVisual() {
  return (
    <div className={`card p-5 ${shadow}`}>
      <div className="flex items-start gap-4">
        <CompanyMark name="Northwind Labs" size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-muted">Northwind Labs</p>
          <p className="font-display text-xl font-bold text-ink">Senior Product Designer</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <span className="btn btn-accent">
          Apply on their site <ExternalLink className="size-4" />
        </span>
        <span className="btn btn-ghost">
          <Bookmark className="size-4" /> Save
        </span>
        <span className="btn btn-ghost">
          <X className="size-4" /> Skip
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {["Too junior", "Wrong location", "Salary too low"].map((r) => (
          <span key={r} className="chip min-h-8 text-sm">
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProfilesVisual() {
  const profiles = [
    { label: "Design", mind: "sarah-design", jobs: 5 },
    { label: "Product", mind: "sarah-product", jobs: 3 },
    { label: "UX Research", mind: "sarah-ux-research", jobs: 4 },
  ];
  return (
    <div className="space-y-3">
      {profiles.map((p, i) => (
        <div key={p.label} className={`card flex items-center gap-4 p-4 ${i === 0 ? shadow : ""}`}>
          <span className="font-display flex size-11 items-center justify-center rounded-full bg-coral text-sm font-bold text-white">
            {p.label[0]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold text-ink">{p.label}</p>
            <p className="font-mono text-sm text-muted">{p.mind}</p>
          </div>
          <span className="tag">{p.jobs} new today</span>
        </div>
      ))}
    </div>
  );
}
