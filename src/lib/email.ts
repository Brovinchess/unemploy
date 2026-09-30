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

export async function sendVerificationCode(to: string, code: string) {
  if (!emailConfigured()) {
    if (process.env.NODE_ENV === "production") throw new Error("Email is not configured");
    console.log(`[email:dev] verification code for ${to}: ${code}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to,
      subject: `${code} is your Career Ninja code`,
      text: `Your Career Ninja verification code is ${code}.\n\nIt expires in 10 minutes. If you didn't ask for it, you can ignore this email.`,
      html: codeEmailHtml(code),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

// Matches the site: night background, raised panel, coral accent. Tables and inline
// styles only, since that's all email clients reliably render.
function codeEmailHtml(code: string) {
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
        <p style="margin:0 0 28px;font-family:${font};font-size:24px;font-weight:500;line-height:1.3;color:#ffffff">Here's your code to join the waitlist</p>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>${digits}</tr></table>
        <p style="margin:28px 0 0;font-family:${font};font-size:14px;line-height:1.6;color:#8b98a5">It expires in 10 minutes. If you didn't ask for it, you can ignore this email.</p>
      </td></tr>
      <tr><td style="padding:24px 8px 0;font-family:${font};font-size:12px;color:#5f6d7a">© ${new Date().getFullYear()} Career Ninja · <a href="https://careerninja.app" style="color:#8b98a5;text-decoration:none">careerninja.app</a> · powered by Hello Minds</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
