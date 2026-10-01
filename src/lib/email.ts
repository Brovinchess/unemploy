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
  const heading = purpose === "waitlist" ? "Here's your code to join the waitlist" : "Here's your code to turn on email updates";
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
  mindName: string;
  label: string;
  jobs: DigestJob[]; // the jobs this search added, best first
  link: string;
  timedOut?: boolean;
}) {
  const { to, mindName, label, jobs, link, timedOut } = args;
  const n = jobs.length;
  const subject =
    n === 0
      ? `${mindName} finished: no new jobs this time`
      : `${n} new ${n === 1 ? "job" : "jobs"} from ${mindName}${jobs[0] ? `, top match ${Math.round(jobs[0].matchScore)}%` : ""}`;
  const intro =
    n === 0
      ? `Your ${label} headhunter searched but found nothing that passed every check. Try again later, or give it a focus for the next search.`
      : `Your ${label} headhunter ${timedOut ? "ran out of time, but found" : "finished searching and found"} ${n} ${n === 1 ? "job" : "jobs"} that passed every check. Each one has a cover letter and answers ready to paste.`;
  const top = jobs.slice(0, 5);
  const text =
    `${intro}\n\n` +
    top.map((j) => `- ${j.title} at ${j.company} (${Math.round(j.matchScore)}% match)`).join("\n") +
    (n > top.length ? `\n…and ${n - top.length} more` : "") +
    `\n\nSee your shortlist: ${link}`;
  await send(to, subject, text, searchDoneHtml({ intro, jobs: top, more: n - top.length, link, empty: n === 0 }));
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
      <tr><td style="padding:24px 8px 0;font-family:${font};font-size:12px;color:#5f6d7a">© ${new Date().getFullYear()} Career Ninja · <a href="https://careerninja.app" style="color:#8b98a5;text-decoration:none">careerninja.app</a> · powered by Hello Minds</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

const FONT = "'Plus Jakarta Sans','Inter',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function searchDoneHtml({ intro, jobs, more, link, empty }: { intro: string; jobs: DigestJob[]; more: number; link: string; empty: boolean }) {
  const rows = jobs
    .map(
      (j) => `<tr><td style="padding:14px 0;border-top:1px solid #2a3744">
        <p style="margin:0;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff">${esc(j.title)}</p>
        <p style="margin:4px 0 0;font-family:${FONT};font-size:13px;color:#8b98a5">${esc(j.company)}${j.place ? ` · ${esc(j.place)}` : ""}${j.verified ? ` · <span style="color:#e08a8c">✓ Verified</span>` : ""}</p>
      </td><td align="right" style="padding:14px 0 14px 12px;border-top:1px solid #2a3744;font-family:${FONT};font-size:15px;font-weight:600;color:#e08a8c;white-space:nowrap">${Math.round(j.matchScore)}%</td></tr>`,
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
        <p style="margin:0 0 8px;font-family:${FONT};font-size:14px;font-weight:500;color:#e08a8c">${empty ? "Search finished" : "Your search is done"}</p>
        <p style="margin:0 0 24px;font-family:${FONT};font-size:15px;line-height:1.6;color:#c4ccd4">${esc(intro)}</p>
        ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>` : ""}
        ${more > 0 ? `<p style="margin:12px 0 0;font-family:${FONT};font-size:13px;color:#8b98a5">…and ${more} more</p>` : ""}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px"><tr><td bgcolor="#c96567" style="background:#c96567;border-radius:999px">
          <a href="${esc(link)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">See your shortlist</a>
        </td></tr></table>
      </td></tr>
      <tr><td style="padding:24px 8px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:#5f6d7a">You get this because you asked for a search. Turn these emails off in Settings. © ${new Date().getFullYear()} Career Ninja · powered by Hello Minds</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
