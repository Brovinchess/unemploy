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
      html: `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto;padding:32px 24px;color:#1f2d3a">
  <p style="font-size:18px;font-weight:600;margin:0 0 24px">careerninja<span style="color:#c96567">.</span></p>
  <p style="margin:0 0 16px">Your verification code is</p>
  <p style="font-size:32px;letter-spacing:8px;font-weight:600;margin:0 0 24px">${code}</p>
  <p style="color:#5d6d7c;font-size:14px;margin:0">It expires in 10 minutes. If you didn't ask for it, you can ignore this email.</p>
</div>`,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
