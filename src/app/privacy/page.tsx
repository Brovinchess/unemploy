import type { Metadata } from "next";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Career Ninja collects to find and apply for your jobs, who sees it, how long it stays, and how to delete it all in one step.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "15 October 2026";
const CONTACT = "rovin@anichess.com";

// Plain, specific and complete: what is collected, why, who sees it, how long it stays, and
// what the person can do about it. Every line here must match what the code does.
const SECTIONS: { title: string; intro?: string; items?: string[] }[] = [
  {
    title: "Who we are",
    intro:
      "Career Ninja (careerninja.app) is a job search service. It gives you an AI headhunter that finds open jobs matching your resume, writes each application, and keeps your applications in one place. This policy explains what information Career Ninja collects, how it is used, and the choices you have. It applies to the website, the app, and the Career Ninja Chrome extension.",
  },
  {
    title: "Information we collect",
    items: [
      "Account. When you sign in with Hello Minds, we receive your Hello Minds account identifier and store the sign-in tokens that let the app act on your behalf, encrypted. You choose a username; your headhunter is named after it.",
      "Resume and preferences. The resume file you upload, the text extracted from it, and the job preferences you set: roles, location, work setting, job type, level, companies to avoid, and how many jobs to find per search.",
      "Application details and answers. If you enter them, the details used to complete job applications: name, email, phone, location, links, current role and company, right to work, notice period, and salary expectation. Also the answers you give to application form questions, so the next form can reuse them. Questions about gender, ethnicity, disability, veteran status or similar are never stored.",
      "Jobs and applications. The jobs your headhunter finds, the application material it writes for each one, the application form questions it reads, the stage you assign to each job, and the record of each search, including the cognition it used.",
      "Email. If you add an email address for search updates, we store it, along with a verification code while it is being confirmed.",
      "Referrals. If you joined through a friend's link, we record which account referred you. Your friend sees your username and the cognition your headhunter has used, nothing else.",
      "Usage. We use PostHog to understand how the product is used: pages viewed, sign-ups, searches started and finished, cards decided, errors the app hits, and session recordings in which every word on screen and everything you type is masked before it leaves your browser, so a recording shows layout and clicks only. This is tied to your account, not sold, and used only to improve Career Ninja.",
      "Waitlist. If you joined the waitlist before launch: your email, name, date of birth (to confirm you are 18 or over), and the job area and country you told us.",
    ],
  },
  {
    title: "How we use it",
    items: [
      "To brief your headhunter so it can search for jobs that fit you and write applications in your words, from your resume.",
      "To answer application form questions on your behalf, from the details and answers you have given. Nothing is guessed. What it does not know is asked of you.",
      "To keep your jobs, applications and stages in one place, and to email you when a search finishes if you asked for that.",
      "To run and improve the service, including fixing problems and understanding which parts people use.",
      "We do not sell your information, and we do not use it for advertising.",
    ],
  },
  {
    title: "Who receives it",
    items: [
      "Hello Minds, which runs your headhunter. Your resume, preferences, application details and saved answers are sent to your own headhunter there and to nothing else on Hello Minds. Hello Minds' handling of your Mind is covered by its own privacy policy.",
      "Employers, only when you apply. A job site receives what you choose to submit on its form. Career Ninja never sends an application without you: you press Submit, or you choose to let the extension send a completed form after a countdown you can cancel.",
      "Service providers that host and run Career Ninja: Vercel (hosting), Supabase (database), Resend (email delivery) and PostHog (usage analytics). Each processes data only to provide its service to us.",
      "Other Career Ninja users never see your resume, details, answers or applications. The one exception is the referral screen described above.",
      "We will disclose information if the law requires it.",
    ],
  },
  {
    title: "The Chrome extension",
    items: [
      "Single purpose: it fills in job application forms with your own Career Ninja data, for the jobs you chose. It runs only on careerninja.app and on the job application pages it supports (Greenhouse, Lever and Ashby). It does not read other websites or your browsing history.",
      "It stores in your browser a sign-in token for your Career Ninja account and your setting for how forms are sent. It fetches from Career Ninja the jobs you chose, their application material, your resume and application details, and reports back when an application was sent.",
      "It reads the fields of the form it is filling. Answers you type into fields it could not fill are saved to your account for reuse. It never fills or saves questions about gender, ethnicity, disability, veteran status or similar.",
      "Auto-send is off by default. If you turn it on, the extension presses Submit only when every required field is filled and there is no human verification, after a five-second countdown you can cancel on each form.",
      "Disconnecting the extension, or signing out of Career Ninja, revokes its token. Remove it from Chrome at any time.",
    ],
  },
  {
    title: "Cookies",
    items: [
      "A session cookie keeps you signed in. A short-lived cookie protects the sign-in handshake with Hello Minds. If you arrive through a referral link, a cookie remembers that for 30 days so the referral can be credited when you sign up.",
      "PostHog stores a small identifier in your browser to recognise it across visits. We do not use advertising cookies.",
    ],
  },
  {
    title: "How long we keep it",
    items: [
      "Your account data, resume, jobs and applications are kept while your account exists.",
      "Facts about job postings themselves (title, company, location, requirements) may be kept after a job leaves your list, so the same posting does not have to be checked again. These records contain nothing about you.",
      "If you delete your account, your account, resume, jobs, applications, details and answers are deleted at once. Your headhunter on Hello Minds is switched off. Hello Minds keeps the Mind itself, because Minds cannot be deleted there.",
      "Usage analytics already recorded in PostHog, and a waitlist entry if you made one, are not removed automatically. Email us and we will delete them.",
    ],
  },
  {
    title: "Your choices",
    items: [
      "Pause your headhunter at any time from its page. It stops searching and stops using cognition.",
      "Edit or remove your application details and saved answers on the You page. Change your resume or preferences on the headhunter's page.",
      "Turn search emails off, or remove your email, in Settings.",
      "Delete everything with Settings → Delete my data.",
      "Email us to ask what we hold about you, to correct it, or to have it deleted.",
    ],
  },
  {
    title: "Security",
    items: [
      "Sign-in tokens are stored encrypted. Keys that let your headhunter and the extension talk to Career Ninja are stored as hashes, so they cannot be read back. All traffic uses HTTPS.",
      "No service can promise perfect security. If we learn of a breach affecting your data, we will tell you.",
    ],
  },
  {
    title: "Age, payments and changes",
    items: [
      "Career Ninja is for people aged 18 or over.",
      "Cognition, the credit your headhunter runs on, is bought from and billed by Hello Minds. Career Ninja does not take payments and does not see your payment details.",
      "If this policy changes in a way that matters, we will update the date at the top and, for significant changes, tell you in the app.",
    ],
  },
  {
    title: "Open data we use",
    intro:
      "Job-title suggestions come from the O*NET 29.3 Database by the U.S. Department of Labor, Employment and Training Administration, used under the Creative Commons Attribution 4.0 licence, with titles merged, de-duplicated and added to. O*NET is a trademark of USDOL/ETA; Career Ninja is not endorsed by them.",
  },
  {
    title: "Contact",
    intro: `Questions about this policy or your data: ${CONTACT}.`,
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
        <p className="eyebrow">Privacy policy</p>
        <h1 className="font-display mt-3 text-3xl font-bold tracking-tight text-ink">How Career Ninja handles your data</h1>
        <p className="mt-2 text-sm text-muted">Last updated {UPDATED}</p>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Career Ninja exists to help you find a job. It collects what that takes, uses it for nothing else, and lets you remove it in one step.
        </p>
        <div className="mt-10 space-y-10">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="font-display text-lg font-bold text-ink">{s.title}</h2>
              {s.intro && <p className="mt-3 leading-relaxed">{s.intro}</p>}
              {s.items && (
                <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
                  {s.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
