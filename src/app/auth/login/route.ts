import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { mindsMode } from "@/lib/minds/config";
import { createPkce, loginUrl } from "@/lib/minds/oauth";
import { createSession } from "@/lib/session";

export async function GET(request: Request) {
  if (mindsMode === "mock") {
    const hmUserId = "mock-user";
    let user = await db.query.users.findFirst({ where: eq(schema.users.hmUserId, hmUserId) });
    if (!user) {
      [user] = await db.insert(schema.users).values({ id: crypto.randomUUID(), hmUserId }).returning();
    }
    await createSession(user.id);
    return NextResponse.redirect(new URL("/start", request.url));
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
