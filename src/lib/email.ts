import "server-only";

// Verification emails go through Resend (https://resend.com). Needs RESEND_API_KEY and
// EMAIL_FROM, e.g. "Career Ninja <hello@careerninja.app>" on a domain verified in Resend.
// In development without them, codes are printed to the server log instead.

export function emailConfigured() {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

// The code flow is available when email can actually be sent, or locally for testing.
export function codeSignupAvailable() {
  return emailConfigured() || process.env.NODE_ENV !== "production";
}

async function send(to: string, subject: string, text: string, html: string) {
  if (!emailConfigured()) {
    if (process.env.NODE_ENV === "production") throw new Error("Email is not configured");
    console.log(`[email:dev] to ${to}: ${subject}\n${text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

export async function sendVerificationCode(to: string, code: string, purpose: "waitlist" | "notify" = "waitlist") {
  const heading = purpose === "waitlist" ? "Here's your code to join the waitlist" : "Here's your code to verify your email";
  await send(
    to,
    `${code} is your Career Ninja code`,
    `Your Career Ninja verification code is ${code}.\n\nIt expires in 10 minutes. If you didn't ask for it, you can ignore this email.`,
    codeEmailHtml(code, heading),
  );
}

export type DigestJob = { title: string; company: string; matchScore: number; place: string; verified: boolean };

// Sent when a search the user asked for has finished.
export async function sendSearchDoneEmail(args: {
  to: string;
  mindName?: string;
  label: string;
  jobs: DigestJob[]; // the jobs this search added, best first
  link: string;
  timedOut?: boolean;
  noCognition?: boolean; // the headhunter's cognition ran out mid-search
  short?: string; // one sentence on why it came back short, when it did
  share?: string; // the person's referral link, offered once the first jobs are in
  unsubscribe?: string;
}) {
  const { to, label, jobs, link, timedOut, noCognition, short, share, unsubscribe } = args;
  const n = jobs.length;
  const subject =
    n === 0
      ? "Career Ninja: no new jobs this time"
      : `${n} new ${n === 1 ? "job" : "jobs"} from Career Ninja${jobs[0] ? `, top match ${Math.round(jobs[0].matchScore)}%` : ""}`;
  const intro = noCognition
    ? `Your ${label} headhunter ran out of cognition before it finished${n ? `, after finding ${n} ${n === 1 ? "job" : "jobs"}` : ""}. Top it up on Hello Minds and ask again.`
    : n === 0
      ? short
        ? `Your ${label} headhunter searched but found nothing that passed every check. ${short}`
        : `Your ${label} headhunter searched but found nothing that passed every check. Widen its search settings on its page and ask again.`
      : `Your ${label} headhunter ${timedOut ? "ran out of time, but found" : "finished searching and found"} ${n} ${n === 1 ? "job" : "jobs"} that passed every check. Keep the ones you like and your headhunter writes each application.${short ? ` ${short}` : ""}`;
  const top = jobs.slice(0, 5);
  const text =
    `${intro}\n\n` +
    top.map((j) => `- ${j.title} at ${j.company}${j.matchScore > 0 ? ` (${Math.round(j.matchScore)}% match)` : ""}`).join("\n") +
    (n > top.length ? `\n…and ${n - top.length} more` : "") +
    `\n\nSee your jobs: ${link}`;
  await send(to, subject, text, searchDoneHtml({ intro, jobs: top, more: n - top.length, link, empty: n === 0 , share, unsubscribe }));
}

// Matches the site: night background, raised panel, coral accent. Tables and inline
// styles only, since that's all email clients reliably render.
function codeEmailHtml(code: string, heading: string) {
  const font = "'Plus Jakarta Sans','Inter',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
  const digits = code
    .split("")
    .map((d) => `<td style="width:44px;height:56px;background:#243240;border-radius:12px;text-align:center;font-family:${font};font-size:26px;font-weight:600;color:#ffffff">${d}</td>`)
    .join(`<td style="width:8px"></td>`);
  return `<!doctype html>
<html><head><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
<body style="margin:0;padding:0;background:#141b22">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#141b22" style="background:#141b22">
  <tr><td align="center" style="padding:48px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px">
      <tr><td style="padding:0 8px 28px;font-family:${font};font-size:20px;font-weight:600;letter-spacing:-0.2px;color:#ffffff">careerninja<span style="color:#c96567">.</span></td></tr>
      <tr><td bgcolor="#1b2530" style="background:#1b2530;border-radius:24px;padding:40px 32px">
        <p style="margin:0 0 8px;font-family:${font};font-size:14px;font-weight:500;color:#e08a8c">Confirm it's you</p>
        <p style="margin:0 0 28px;font-family:${font};font-size:24px;font-weight:500;line-height:1.3;color:#ffffff">${heading}</p>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>${digits}</tr></table>
        <p style="margin:28px 0 0;font-family:${font};font-size:14px;line-height:1.6;color:#8b98a5">It expires in 10 minutes. If you didn't ask for it, you can ignore this email.</p>
      </td></tr>
      <tr><td style="padding:24px 8px 0;font-family:${font};font-size:12px;color:#5f6d7a">© ${new Date().getFullYear()} Career Ninja · <a href="https://careerninja.app" style="color:#8b98a5;text-decoration:none">careerninja.app</a> · in partnership with Hello Minds</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

const FONT = "'Plus Jakarta Sans','Inter',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function searchDoneHtml({ intro, jobs, more, link, empty, share, unsubscribe, title, cta }: { intro: string; jobs: DigestJob[]; more: number; link: string; empty: boolean; share?: string; unsubscribe?: string; title?: string; cta?: string }) {
  const rows = jobs
    .map(
      (j) => `<tr><td style="padding:14px 0;border-top:1px solid #2a3744">
        <p style="margin:0;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff">${esc(j.title)}</p>
        <p style="margin:4px 0 0;font-family:${FONT};font-size:13px;color:#8b98a5">${esc(j.company)}${j.place ? ` · ${esc(j.place)}` : ""}${j.verified ? ` · <span style="color:#e08a8c">✓ Verified</span>` : ""}</p>
      </td><td align="right" style="padding:14px 0 14px 12px;border-top:1px solid #2a3744;font-family:${FONT};font-size:15px;font-weight:600;color:#e08a8c;white-space:nowrap">${j.matchScore > 0 ? `${Math.round(j.matchScore)}%` : ""}</td></tr>`,
    )
    .join("");
  return `<!doctype html>
<html><head><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
<body style="margin:0;padding:0;background:#141b22">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#141b22" style="background:#141b22">
  <tr><td align="center" style="padding:48px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
      <tr><td style="padding:0 8px 28px;font-family:${FONT};font-size:20px;font-weight:600;color:#ffffff">careerninja<span style="color:#c96567">.</span></td></tr>
      <tr><td bgcolor="#1b2530" style="background:#1b2530;border-radius:24px;padding:36px 32px">
        <p style="margin:0 0 8px;font-family:${FONT};font-size:14px;font-weight:500;color:#e08a8c">${esc(title ?? (empty ? "Search finished" : "Your search is done"))}</p>
        <p style="margin:0 0 24px;font-family:${FONT};font-size:15px;line-height:1.6;color:#c4ccd4">${esc(intro)}</p>
        ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>` : ""}
        ${more > 0 ? `<p style="margin:12px 0 0;font-family:${FONT};font-size:13px;color:#8b98a5">…and ${more} more</p>` : ""}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px"><tr><td bgcolor="#c96567" style="background:#c96567;border-radius:999px">
          <a href="${esc(link)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${esc(cta ?? "See your jobs")}</a>
        </td></tr></table>
        ${share && !empty ? `<p style="margin:28px 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:#8b98a5">Know someone job hunting? Their first searches are free with your link:<br><a href="${esc(share)}" style="color:#e08a8c;text-decoration:none">${esc(share)}</a></p>` : ""}
      </td></tr>
      <tr><td style="padding:24px 8px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:#5f6d7a">${unsubscribe ? `<a href="${esc(unsubscribe)}" style="color:#5f6d7a">Turn these emails off</a>, or change them in Settings.` : "Turn these emails off in Settings."} © ${new Date().getFullYear()} Career Ninja · in partnership with Hello Minds</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}


// ---- Emails the app sends on its own ------------------------------------------------------

import { createHmac, timingSafeEqual } from "node:crypto";

const secret = () => process.env.TOKEN_ENCRYPTION_KEY || process.env.CRON_SECRET || "dev-only";
const sign = (userId: string) => createHmac("sha256", secret()).update(`unsub:${userId}`).digest("base64url").slice(0, 24);
// One-click off switch at the foot of every email; the link carries a signature, not a session.
export function unsubscribeLink(userId: string) {
  const base = (process.env.APP_URL ?? "https://careerninja.app").replace(/\/$/, "");
  return `${base}/email/unsubscribe?u=${encodeURIComponent(userId)}&t=${sign(userId)}`;
}
export function verifyUnsubscribe(userId: string, token: string) {
  const a = Buffer.from(sign(userId)), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

// The day after a sign-in that stopped before the headhunter was set up.
export async function sendSetupReminderEmail(args: { to: string; link: string; unsubscribe: string }) {
  const intro = "You signed in to Career Ninja but didn't finish setting up your headhunter. It takes about two minutes: tell it the role you want and where you live, and it goes looking. Your first searches are free.";
  await send(
    args.to,
    "Your headhunter is ready when you are",
    `${intro}\n\nFinish setting up: ${args.link}\n\nTurn these emails off: ${args.unsubscribe}`,
    searchDoneHtml({ title: "Two minutes to finish", intro, jobs: [], more: 0, link: args.link, empty: true, cta: "Finish setting up", unsubscribe: args.unsubscribe }),
  );
}

// Monday: postings seen open this week that fit the person's role and place, before any search.
export async function sendWeeklyDigestEmail(args: { to: string; role: string; place: string; postings: DigestJob[]; link: string; unsubscribe: string }) {
  const { role, place, postings } = args;
  const intro = `Postings seen open this week that fit what you asked for: ${role} in ${place}. Your headhunter hasn't checked these yet. Start a search and it checks each one, then writes your applications.`;
  const lines = postings.map((p) => `- ${p.title} at ${p.company}${p.place ? `, ${p.place}` : ""}`).join("\n");
  await send(
    args.to,
    `New ${role} postings in ${place}`,
    `${intro}\n\n${lines}\n\nFind new jobs: ${args.link}\n\nTurn these emails off: ${args.unsubscribe}`,
    searchDoneHtml({ title: "This week", intro, jobs: postings, more: 0, link: args.link, empty: false, cta: "Find new jobs", unsubscribe: args.unsubscribe }),
  );
}

// ---- Morning searches ------------------------------------------------------------------------

// The day's searches ran and found nothing, so daily search paused: one email with the one
// change most likely to help, and where to turn it back on.
export async function sendMorningZeroEmail(args: { to: string; label: string; role: string; place: string; headline: string; body: string; cta: string; link: string; unsubscribe: string }) {
  const intro = `Your ${args.label} headhunter searched for ${args.role} in ${args.place} twice today and nothing passed every check, so daily search is paused rather than spend more on the same results. ${args.headline} ${args.body} Make the change, then turn daily search back on from your headhunter's page.`;
  await send(
    args.to,
    "Daily search paused, and the one change that helps",
    `${intro}\n\n${args.cta}: ${args.link}\n\nTurn these emails off: ${args.unsubscribe}`,
    searchDoneHtml({ title: "Daily search paused", intro, jobs: [], more: 0, link: args.link, empty: true, cta: args.cta, unsubscribe: args.unsubscribe }),
  );
}

// The balance could not cover a morning search, so morning searches switched themselves off.
export async function sendMorningOffEmail(args: { to: string; label: string; topUp: string; unsubscribe: string }) {
  const intro = `Your ${args.label} headhunter's cognition ran out, so today's search could not start and your daily search is now off. Top up on Hello Minds, then turn it back on from your headhunter's page. Your settings and your jobs are as you left them.`;
  await send(
    args.to,
    "Your daily search has stopped",
    `${intro}\n\nTop up: ${args.topUp}\n\nTurn these emails off: ${args.unsubscribe}`,
    searchDoneHtml({ title: "Daily search", intro, jobs: [], more: 0, link: args.topUp, empty: true, cta: "Top up on Hello Minds", unsubscribe: args.unsubscribe }),
  );
}

// Cards that have sat unswiped for hours.
export async function sendCardsWaitingEmail(args: { to: string; n: number; jobs: DigestJob[]; link: string; unsubscribe: string }) {
  const n = args.n;
  const intro = `Your headhunter found ${n} ${n === 1 ? "job" : "jobs"} that passed every check, and ${n === 1 ? "it has" : "they have"} been waiting for a few hours. Swipe right to keep one and your headhunter writes the application. Swipe left and it learns what to skip next time.`;
  await send(
    args.to,
    `${n} ${n === 1 ? "job is" : "jobs are"} waiting for you`,
    `${intro}\n\n${args.jobs.map((j) => `- ${j.title} at ${j.company}`).join("\n")}\n\nReview them: ${args.link}\n\nTurn these emails off: ${args.unsubscribe}`,
    searchDoneHtml({ title: "Waiting for you", intro, jobs: args.jobs, more: Math.max(0, n - args.jobs.length), link: args.link, empty: false, cta: n === 1 ? "Review it" : "Review them", unsubscribe: args.unsubscribe }),
  );
}

// ---- Welcome, weekly summary, come back --------------------------------------------------------

// The moment the email is verified. Three short lines on what happens next.
export async function sendWelcomeEmail(args: { to: string; link: string; unsubscribe: string }) {
  const intro = "Your headhunter searches employers' own sites for jobs you fit, checks each one is still open, and sends you the good ones as cards. The first ones usually land within the hour. Swipe right on a job and it writes the application for you. When you are ready to apply, add the Chrome extension and it fills in the forms.";
  await send(
    args.to,
    "You're set. Here's what happens next",
    `${intro}\n\nOpen Career Ninja: ${args.link}\n\nTurn these emails off: ${args.unsubscribe}`,
    searchDoneHtml({ title: "Welcome", intro, jobs: [], more: 0, link: args.link, empty: true, cta: "Open Career Ninja", unsubscribe: args.unsubscribe }),
  );
}

// Mondays, for people with daily search on: what their headhunter did last week, in numbers.
export async function sendWeeklySummaryEmail(args: { to: string; searches: number; found: number; kept: number; applied: number; best: DigestJob | null; link: string; unsubscribe: string }) {
  const { searches, found, kept, applied, best } = args;
  const n = (x: number, one: string, many = one + "s") => `${x} ${x === 1 ? one : many}`;
  const intro = `Last week your headhunter ran ${n(searches, "search", "searches")} and found ${n(found, "job")} that passed every check. You kept ${kept} and applied to ${applied}.${best ? ` Your best match was ${best.title} at ${best.company}, ${Math.round(best.matchScore)}%.` : ""}`;
  await send(
    args.to,
    `Your week: ${n(found, "job")} found, ${kept} kept`,
    `${intro}\n\nSee your jobs: ${args.link}\n\nTurn these emails off: ${args.unsubscribe}`,
    searchDoneHtml({ title: "Your week", intro, jobs: best ? [best] : [], more: 0, link: args.link, empty: !best, cta: "See your jobs", unsubscribe: args.unsubscribe }),
  );
}

// Two quiet weeks: one email, then nothing more.
export async function sendComebackEmail(args: { to: string; waiting: number; jobs: DigestJob[]; dailyOn: boolean; link: string; unsubscribe: string }) {
  const { waiting, jobs, dailyOn } = args;
  const intro =
    waiting > 0
      ? `It has been two weeks. In that time your headhunter found ${waiting} ${waiting === 1 ? "job" : "jobs"} that passed every check. ${waiting === 1 ? "It is" : "They are"} on your board, waiting for a yes or a no.`
      : dailyOn
        ? "It has been two weeks. Your headhunter has kept searching and found nothing new that passed every check. One change to your settings usually opens things up, and the card on your jobs page says which."
        : "It has been two weeks since your last search. New postings go up every day, and a fresh search takes about an hour. Your headhunter picks up right where it left off.";
  await send(
    args.to,
    waiting > 0 ? `${waiting} ${waiting === 1 ? "job is" : "jobs are"} waiting for you` : "Still looking? Your headhunter is",
    `${intro}\n\n${waiting > 0 ? "See them" : "Open Career Ninja"}: ${args.link}\n\nTurn these emails off: ${args.unsubscribe}`,
    searchDoneHtml({ title: "While you were away", intro, jobs, more: Math.max(0, waiting - jobs.length), link: args.link, empty: waiting === 0, cta: waiting > 0 ? "See them" : "Open Career Ninja", unsubscribe: args.unsubscribe }),
  );
}
