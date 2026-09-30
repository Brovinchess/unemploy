import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { encrypt } from "@/lib/crypto";
import { exchangeCode, tokenSubject } from "@/lib/minds/oauth";
import { createSession } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fail = (reason: string) => NextResponse.redirect(new URL(`/?login_error=${reason}`, request.url));

  if (url.searchParams.get("error")) return fail("denied");

  const jar = await cookies();
  const raw = jar.get("unemploy_pkce")?.value;
  jar.delete("unemploy_pkce");
  if (!raw) return fail("expired");

  const { verifier, state } = JSON.parse(raw) as { verifier: string; state: string };
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
  const values = {
    accessToken: encrypt(tokens.accessToken),
    refreshToken: encrypt(tokens.refreshToken),
    tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    scope: tokens.scope,
  };
  let user = await db.query.users.findFirst({ where: eq(schema.users.hmUserId, hmUserId) });
  if (user) {
    await db.update(schema.users).set(values).where(eq(schema.users.id, user.id));
  } else {
    [user] = await db
      .insert(schema.users)
      .values({ id: crypto.randomUUID(), hmUserId, ...values })
      .returning();
  }

  await createSession(user.id);
  return NextResponse.redirect(new URL("/start", request.url));
}
