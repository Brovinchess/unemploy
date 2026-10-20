import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { Ninja } from "@/components/brand";
import { PublicPage } from "@/components/public-page";
import { PAINS, STEPS } from "@/lib/landing-copy";
import { MAX_POSTING_AGE_DAYS } from "@/lib/preferences";

export const metadata: Metadata = {
  title: "How It Works: AI Job Search in Six Steps",
  description: "How the AI headhunter finds open jobs that fit your resume, checks each one, writes the application and fills the form. Three of six steps are yours.",
  alternates: { canonical: "/how-it-works" },
};

// Every check a job passes before it reaches the person. Same rules as the app enforces.
const CHECKS = [
  "Posted on the employer's own site, not a job board copy.",
  "Open today. The posting is loaded and read before it is sent.",
  `Posted in the last ${MAX_POSTING_AGE_DAYS} days.`,
  "Hireable from your country, read from the posting's own location and eligibility lines.",
  "A real fit: the requirements are counted against your resume and the card shows which ones you meet.",
  "Not a job you have already seen, in this search or an earlier one.",
];

export default function HowItWorks() {
  return (
    <PublicPage eyebrow="How it works" title="From resume to Submit, in six steps" intro="Career Ninja gives you an AI headhunter that searches, checks and writes. You set it up, swipe through what it finds, and press Submit.">
      <ol className="mx-auto mt-14 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((st, i) => (
          <li key={st.title} className="relative rounded-3xl bg-surface p-5 sm:p-6">
            <div className="flex items-start justify-between">
              <span className="flex size-10 items-center justify-center rounded-xl bg-coral/15 text-rose">
                <st.icon className="size-[18px]" aria-hidden />
              </span>
              <Ninja mood={st.mood} className="-mt-1 hidden size-11 sm:block" />
            </div>
            <p className="font-display mt-3 text-xs font-medium text-coral sm:mt-4">0{i + 1}</p>
            <h2 className="font-display mt-1 text-lg font-medium text-white">{st.title}</h2>
            <p className="mt-1.5 text-[15px] leading-relaxed text-white/55">{st.body}</p>
          </li>
        ))}
      </ol>

      <section className="mx-auto mt-20 max-w-6xl">
        <h2 className="font-display text-center text-[1.75rem] font-medium tracking-[-0.01em] sm:text-[2.25rem]">What a job passes before you see it</h2>
        <ul className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-2">
          {CHECKS.map((c) => (
            <li key={c} className="flex gap-2.5 rounded-2xl bg-surface p-4 text-[15px] leading-relaxed text-white/80">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-coral" aria-hidden /> {c}
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto mt-20 max-w-6xl">
        <h2 className="font-display text-center text-[1.75rem] font-medium tracking-[-0.01em] sm:text-[2.25rem]">What changes for you</h2>
        <ul className="mt-8 grid gap-5 md:grid-cols-3">
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
    </PublicPage>
  );
}
