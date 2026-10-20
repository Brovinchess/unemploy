import type { Metadata } from "next";
import { ExtensionMock } from "@/components/landing-art";
import { PublicPage } from "@/components/public-page";
import { EXTENSION_POINTS, STORE_URL } from "@/lib/landing-copy";

export const metadata: Metadata = {
  title: "Chrome Extension That Fills Job Applications",
  description: "Fills job application forms on Greenhouse, Lever and Ashby with your details, resume, cover letter and answers, then waits for you to press Submit.",
  alternates: { canonical: "/extension" },
};

const HOW = [
  "Add the extension from the Chrome Web Store and sign in to Career Ninja.",
  "Keep a job in the app. Your headhunter writes the cover letter and the answers to its form.",
  "Press Apply now. The extension opens the form and fills it in while you watch.",
  "Read it, change anything you want, and press Submit on the employer's page.",
];

export default function Extension() {
  return (
    <PublicPage eyebrow="Chrome extension" title="Job applications, filled in for you" intro="Your headhunter writes the application. The Career Ninja extension types it into the employer's form, field by field, and stops before Submit.">
      <div className="mx-auto mt-10 flex flex-col items-center gap-3">
        <a href={STORE_URL} target="_blank" rel="noopener noreferrer" className="btn btn-accent h-12 px-7 text-base">
          Add to Chrome
        </a>
        <span className="text-sm text-white/45">Free. Works in Chrome, Brave, Edge and other Chromium browsers.</span>
      </div>

      <div className="mx-auto mt-14 grid max-w-6xl items-center gap-10 md:grid-cols-2 md:gap-14">
        <ul className="grid gap-4">
          {EXTENSION_POINTS.map((p) => (
            <li key={p.title} className="rounded-3xl bg-surface p-5">
              <h2 className="font-display text-lg font-medium text-white">{p.title}</h2>
              <p className="mt-1.5 text-[15px] leading-relaxed text-white/55">{p.body}</p>
            </li>
          ))}
        </ul>
        <div className="flex justify-center" aria-hidden>
          <ExtensionMock />
        </div>
      </div>

      <section className="mx-auto mt-20 max-w-3xl">
        <h2 className="font-display text-center text-[1.75rem] font-medium tracking-[-0.01em] sm:text-[2.25rem]">How to use it</h2>
        <ol className="mt-8 space-y-3">
          {HOW.map((h, i) => (
            <li key={h} className="flex gap-4 rounded-2xl bg-surface p-4">
              <span className="font-display text-sm font-medium text-coral">0{i + 1}</span>
              <span className="text-[15px] leading-relaxed text-white/80">{h}</span>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-center text-sm text-white/45">
          Chrome may show a warning about Enhanced Safe Browsing for new publishers. It goes away on its own once the extension has been in the store for a while.
        </p>
      </section>
    </PublicPage>
  );
}
