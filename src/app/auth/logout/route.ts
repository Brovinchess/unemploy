import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { mindsMode } from "@/lib/minds/config";
import { decrypt } from "@/lib/crypto";
import { revoke } from "@/lib/minds/oauth";
import { destroySession, getCurrentUser } from "@/lib/session";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (user?.refreshToken && mindsMode === "live") {
    await revoke(decrypt(user.refreshToken)).catch(() => {});
    await db
      .update(schema.users)
      .set({ accessToken: null, refreshToken: null, tokenExpiresAt: null })
      .where(eq(schema.users.id, user.id));
  }
  await destroySession();
  return NextResponse.redirect(new URL("/", request.url), 303);
}
