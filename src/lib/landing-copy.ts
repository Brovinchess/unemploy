import { FileText, Hand, Puzzle, Search, ShieldCheck, UserRound } from "lucide-react";
import type { Mood } from "@/components/brand";
import { MAX_POSTING_AGE_DAYS } from "@/lib/preferences";

// Copy shared by the landing page, the how-it-works page and the extension page, so each says
// the same thing and the search snippets Google builds from them match. Everything here is true
// of the product today; numbers come from the same code the app uses.

export const STORE_URL = "https://chromewebstore.google.com/detail/career-ninja/pegmolmikinefghoeollhdaaedbddkaa";

export const STEPS: { icon: typeof Search; mood: Mood; title: string; body: string }[] = [
  { icon: UserRound, mood: "happy", title: "Sign in, get your headhunter", body: "One click sets up an AI headhunter that works only for you. It runs only when you ask." },
  { icon: FileText, mood: "thinking", title: "Tell it what you want", body: "Upload your resume, or answer a few questions if you don't have one, then pick the roles you want and where you live." },
  { icon: Search, mood: "searching", title: "Ask, and it searches", body: "Press Find new jobs. Each job lands on your page the moment it passes every check, so you can start while it keeps looking." },
  { icon: ShieldCheck, mood: "excited", title: "Checked before it reaches you", body: `On the employer's own site, open today, posted in the last ${MAX_POSTING_AGE_DAYS} days, hireable from your country, and a real fit for your resume.` },
  { icon: Hand, mood: "surprised", title: "Swipe right to apply", body: "Jobs come as cards. Reveal one, swipe right to keep it, left to dismiss. Kept jobs line up from To apply to Offer." },
  {
    icon: Puzzle,
    mood: "love",
    title: "The form fills itself",
    body: "The Chrome extension opens each application, fills in your details, cover letter and answers, and waits for you to press Submit.",
  },
];

// What job hunting feels like today, and what changes.
export const PAINS = [
  { pain: "Hours scrolling job boards full of reposts and jobs that closed weeks ago.", gain: "You see only jobs checked open today, on the employer's own site." },
  { pain: "\"Remote\" that turns out to mean one country, found after you've applied.", gain: "Every posting's own eligibility line is read before it reaches you." },
  { pain: "Rewriting the same cover letter and the same twenty form answers, again.", gain: "Written once from your resume, answered once about you, filled in every time." },
];

export const FAQ = [
  {
    q: "Is Career Ninja an AI job search tool or an auto-apply bot?",
    a: "A job search tool with a person in charge. Your AI headhunter finds open jobs that fit your resume and writes each application. The Chrome extension fills in the form. You read it and press Submit, so nothing goes out that you haven't seen.",
  },
  {
    q: "Does it apply for me?",
    a: "Almost. It finds the job and writes the application. The Chrome extension fills the form for you, and leaves Submit to you unless you choose to let it send.",
  },
  {
    q: "Which job sites does the extension fill?",
    a: "Application forms on Greenhouse, Lever and Ashby, which many tech and startup employers use. For other sites, your headhunter still writes the cover letter and answers, and you paste them in.",
  },
  {
    q: "What about the questions only I can answer?",
    a: "Forms ask things like notice period, relocation, or years with a tool. Your headhunter answers those from your details and your past answers. Anything it doesn't know comes to you once, and it remembers from then on.",
  },
  {
    q: "Will it make things up about me?",
    a: "No. Every claim in a cover letter or answer must quote a line from your resume, and the app checks it. Answers it doesn't know come to you instead of being guessed.",
  },
  {
    q: "How much does it cost?",
    a: "Your first searches are free. Each search uses cognition from your Hello Minds account, and you choose how many jobs to look for, so you decide what a search costs.",
  },
  {
    q: "What happens to my resume?",
    a: "It's used only to find and write for your jobs, and is shared only with your own headhunter. You can delete your account, resume and every job in one step from Settings.",
  },
];

// The Chrome extension, in the words the store listing uses.
export const EXTENSION_POINTS = [
  { title: "Fills the whole form", body: "Name, contact details, resume file, cover letter and every question your headhunter has an answer for. Dropdowns and checkboxes included." },
  { title: "Stops before Submit", body: "It fills, then waits. You read the page, change anything you like, and press Submit yourself." },
  { title: "Asks you once", body: "A question it can't answer is highlighted. Type the answer and it's remembered for the next form that asks the same thing." },
  { title: "Works where tech jobs are posted", body: "Greenhouse, Lever and Ashby application forms. More sites are added as people ask for them." },
];
