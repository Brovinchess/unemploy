import type { Metadata } from "next";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Privacy — Unemploy" };

const SECTIONS = [
  {
    title: "What we store",
    items: [
      "If you join the waitlist: your email, name and date of birth (to confirm you're 18 or over), and which job area and country you're interested in, if you tell us.",
      "Your Hello Minds account id and the username you choose.",
      "Sign-in tokens from Hello Minds, encrypted, so the app can act for your headhunters.",
      "Each resume you upload, the text read from it, and the job preferences you set.",
      "The jobs your headhunters find, their application packs, and the status you give each job.",
    ],
  },
  {
    title: "Who sees it",
    items: [
      "Your resume and preferences are sent only to your own Hello Minds headhunters, so they can search for you.",
      "Job sites see nothing from us. You decide what to send them when you apply.",
      "We don't sell your data or share it with employers or advertisers.",
    ],
  },
  {
    title: "Your control",
    items: [
      "Pause a headhunter any time; it stops searching and spending cognition.",
      "Settings → Delete my data removes your account, resumes, shortlists and tracker, and turns off your headhunters. Hello Minds keeps the agents themselves, because agents can't be deleted there.",
      "Cognition is bought and billed by Hello Minds, not by Unemploy.",
    ],
  },
];

export default function Privacy() {
  return (
    <div className="flex flex-1 flex-col bg-surface">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4 sm:px-6">
          <Logo />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <p className="eyebrow">Privacy</p>
        <h1 className="font-display mt-3 text-3xl font-bold tracking-tight text-ink">How Unemploy handles your data</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Unemploy exists to help you find a job, and it only uses your data for that.
        </p>
        <div className="mt-10 space-y-10">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="font-display text-lg font-bold text-ink">{s.title}</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
                {s.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
