import { NextResponse } from "next/server";
import { isReferralCode, REF_COOKIE, REF_COOKIE_DAYS } from "@/lib/referrals";

// A friend's link: remember whose it was, then show the landing page.
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const res = NextResponse.redirect(new URL("/?ref=1", request.url));
  if (isReferralCode(code.toLowerCase())) {
    res.cookies.set(REF_COOKIE, code.toLowerCase(), { httpOnly: true, sameSite: "lax", secure: request.url.startsWith("https://"), path: "/", maxAge: REF_COOKIE_DAYS * 86_400 });
  }
  return res;
}
