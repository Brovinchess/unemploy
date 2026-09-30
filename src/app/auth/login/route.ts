import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, schema } from "@/db";
import { launchMode } from "@/lib/launch";
import { mindsMode } from "@/lib/minds/config";
import { hasEncryptionKey } from "@/lib/crypto";
import { createPkce, loginUrl } from "@/lib/minds/oauth";
import { createSession } from "@/lib/session";

export async function GET(request: Request) {
  // Before launch, sign-in is closed except with the early-access code (for the team and testers).
  if (launchMode === "waitlist") {
    const code = process.env.EARLY_ACCESS_CODE;
    const given = new URL(request.url).searchParams.get("access");
    if (!code || !given || given !== code) return NextResponse.redirect(new URL("/", request.url));
  }

  if (mindsMode === "mock") {
    // Demo mode: every visitor gets their own throwaway account.
    const [user] = await db
      .insert(schema.users)
      .values({ id: crypto.randomUUID(), hmUserId: `demo-${crypto.randomUUID()}` })
      .returning();
    await createSession(user.id);
    return NextResponse.redirect(new URL("/start", request.url));
  }

  if (!hasEncryptionKey()) {
    console.error("[auth] TOKEN_ENCRYPTION_KEY is missing; refusing to start sign-in");
    return NextResponse.redirect(new URL("/?login_error=config", request.url));
  }

  const { verifier, challenge, state } = createPkce();
  // The verifier must survive the round trip to Hello Minds and back.
  (await cookies()).set("unemploy_pkce", JSON.stringify({ verifier, state }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/auth",
    maxAge: 600,
  });
  return NextResponse.redirect(loginUrl(challenge, state));
}
