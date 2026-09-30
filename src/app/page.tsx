import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FileText, ListChecks, Sparkles } from "lucide-react";
import { CompanyMark, Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/session";

const LOGIN_ERRORS: Record<string, string> = {
  denied: "Sign-in was cancelled. You can try again whenever you're ready.",
  expired: "Sign-in took too long. Please try again.",
  state: "Something went wrong with sign-in. Please try again.",
  exchange: "Hello Minds couldn't complete sign-in. Please try again.",
  config: "Sign-in is temporarily unavailable. Please try again later.",
};

const PREVIEW = [
  { title: "Senior Product Designer", company: "Northwind Labs", tags: ["Hybrid", "Kuala Lumpur"], score: 94 },
  { title: "Product Designer, Payments", company: "Fernhill Bank", tags: ["On-site", "Full-time"], score: 89 },
  { title: "UX Designer", company: "Kitefly", tags: ["Remote", "Malaysia"], score: 83 },
];

const STEPS = [
  {
    icon: FileText,
    title: "Upload your resume",
    body: "Answer a few questions: where you want to work, what kind of role, and how many jobs a day.",
  },
  {
    icon: ListChecks,
    title: "Get a daily shortlist",
    body: "Every morning your headhunter brings the best matches, with an honest note on how well you fit.",
  },
  {
    icon: Sparkles,
    title: "Apply in minutes",
    body: "Each job comes with a cover letter and answers written from your real experience. Nothing made up.",
  },
];

export default async function Home({ searchParams }: PageProps<"/">) {
  const user = await getCurrentUser();
  if (user) redirect("/start");
  const sp = await searchParams;
  const error = typeof sp.login_error === "string" ? LOGIN_ERRORS[sp.login_error] : undefined;
  const deleted = sp.deleted === "1";

  return (
    <div className="flex flex-1 flex-col bg-surface">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-2">
            <Link href="/auth/login" className="btn btn-sm text-navy hover:bg-mist-soft">
              Sign in
            </Link>
            <Link href="/auth/login" className="btn btn-sm btn-primary">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="bg-canvas">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
            <div>
              <p className="eyebrow">Your own AI headhunter</p>
              <h1 className="font-display mt-4 text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-6xl">
                Fewer applications.
                <br />
                <span className="text-coral">Better ones.</span>
              </h1>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
                Unemploy gives you a personal headhunter that searches every day, picks the jobs you&rsquo;d actually
                win, and writes your application for each one.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link href="/auth/login" className="btn btn-primary">
                  Get started <ArrowRight className="size-4" aria-hidden />
                </Link>
                <span className="text-sm text-muted">Sign in with your Hello Minds account</span>
              </div>
              {error && <p className="mt-6 rounded-xl bg-coral-soft px-4 py-3 text-sm text-rose">{error}</p>}
              {deleted && (
                <p className="mt-6 rounded-xl bg-mist-soft px-4 py-3 text-sm">Your account and data have been deleted.</p>
              )}
            </div>

            <div className="card p-4 shadow-[0_24px_60px_-30px_rgba(49,68,85,0.35)] sm:p-5" aria-hidden>
              <div className="flex items-center justify-between px-1 pb-4">
                <p className="font-display font-bold text-ink">Today&rsquo;s shortlist</p>
                <span className="tag">3 new</span>
              </div>
              <ul className="space-y-2">
                {PREVIEW.map((j, i) => (
                  <li
                    key={j.title}
                    className={`flex items-center gap-3 rounded-xl border p-3 ${i === 0 ? "border-navy/20 bg-mist-soft/60" : "border-line"}`}
                  >
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
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="eyebrow">How it works</p>
          <h2 className="font-display mt-3 max-w-lg text-3xl font-bold tracking-tight text-ink">
            A headhunter that works for you, not for the company.
          </h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.title} className="card p-6">
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-coral-soft text-coral">
                  <s.icon className="size-5" aria-hidden />
                </span>
                <h3 className="font-display mt-5 text-lg font-bold text-ink">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-20 sm:px-6 md:grid-cols-3">
            <div>
              <p className="eyebrow">Why Unemploy</p>
              <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-ink">Quality over spam.</h2>
            </div>
            <p className="leading-relaxed text-muted">
              Mass-apply tools send hundreds of generic applications, and recruiters ignore them. Your headhunter
              brings you a few strong matches a day, and every line it writes about you comes from your own resume.
            </p>
            <p className="leading-relaxed text-muted">
              You stay in control. Nothing is sent without you, you choose how many jobs a day it looks for, and you
              can pause it any time.
            </p>
          </div>
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
