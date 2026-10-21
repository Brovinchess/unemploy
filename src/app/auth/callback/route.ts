import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { encrypt } from "@/lib/crypto";
import { exchangeCode, tokenEmail, tokenSubject } from "@/lib/minds/oauth";
import { createSession } from "@/lib/session";
import { track } from "@/lib/analytics/server";
import { attachReferral, REF_COOKIE } from "@/lib/referrals";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fail = (reason: string) => NextResponse.redirect(new URL(`/?login_error=${reason}`, request.url));

  const jar = await cookies();
  const raw = jar.get("unemploy_pkce")?.value;
  jar.delete("unemploy_pkce");
  let verifier = "", state = "", noEmail = false;
  try {
    ({ verifier, state, noEmail = false } = JSON.parse(raw ?? "{}") as { verifier: string; state: string; noEmail?: boolean });
  } catch {
    /* handled below */
  }

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    // The client is not allowed to ask for the email scope: ask again without it, once.
    const scopeProblem = /scope/i.test(`${oauthError} ${url.searchParams.get("error_description") ?? ""}`);
    if (scopeProblem && !noEmail) return NextResponse.redirect(new URL("/auth/login?noemail=1", request.url));
    return fail("denied");
  }
  if (!raw) return fail("expired");
  if (!verifier || !state) return fail("expired");
  const code = url.searchParams.get("code");
  if (!code || url.searchParams.get("state") !== state) return fail("state");

  let tokens;
  try {
    tokens = await exchangeCode(code, verifier);
  } catch (e) {
    console.error("[auth] code exchange failed", e);
    return fail("exchange");
  }

  const hmUserId = tokenSubject(tokens.accessToken);
  // The account email from Hello Minds, already verified there. Fills an empty email only;
  // an address the person typed and confirmed themselves is left alone.
  const email = tokenEmail(tokens);
  const values = {
    accessToken: encrypt(tokens.accessToken),
    refreshToken: encrypt(tokens.refreshToken),
    tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    scope: tokens.scope,
  };
  let user = await db.query.users.findFirst({ where: eq(schema.users.hmUserId, hmUserId) });
  const newUser = !user;
  const gotEmail = !!email && !user?.email;
  if (user) {
    await db.update(schema.users).set({ ...values, ...(gotEmail ? { email, emailVerifiedAt: new Date() } : {}) }).where(eq(schema.users.id, user.id));
  } else {
    [user] = await db
      .insert(schema.users)
      .values({ id: crypto.randomUUID(), hmUserId, ...values, ...(email ? { email, emailVerifiedAt: new Date() } : {}) })
      .returning();
  }
  // A friend's link brought them here: record it on the brand-new account only.
  const ref = jar.get(REF_COOKIE)?.value;
  const referred = newUser ? await attachReferral(user.id, ref).catch((e) => (console.error("[auth] referral", e), false)) : false;
  if (ref) jar.delete(REF_COOKIE);
  track(user.id, "signed_in", { new_user: newUser, referred, email_from_minds: gotEmail || (newUser && !!email) });

  await createSession(user.id);
  return NextResponse.redirect(new URL("/start", request.url));
}
