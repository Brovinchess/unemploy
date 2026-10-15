import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { mindsMode } from "@/lib/minds/config";
import { decrypt } from "@/lib/crypto";
import { revoke } from "@/lib/minds/oauth";
import { revokeExtensionTokens } from "@/lib/extension";
import { endSearch, isSearching } from "@/lib/search";
import { destroySession, getCurrentUser } from "@/lib/session";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  // A running search needs the user's token to switch its Mind off later; end it now, while we still have one.
  if (user) {
    const running = await db.query.profiles.findMany({ where: eq(schema.profiles.userId, user.id) });
    for (const p of running) if (isSearching(p)) await endSearch(p, "stopped").catch((e) => console.error("[logout] end search", p.id, e));
  }
  if (user?.refreshToken && mindsMode === "live") {
    await revoke(decrypt(user.refreshToken)).catch(() => {});
    await db
      .update(schema.users)
      .set({ accessToken: null, refreshToken: null, tokenExpiresAt: null })
      .where(eq(schema.users.id, user.id));
  }
  if (user) await revokeExtensionTokens(user.id).catch(() => {});
  await destroySession();
  return NextResponse.redirect(new URL("/", request.url), 303);
}
