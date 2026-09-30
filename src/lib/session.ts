import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, schema } from "@/db";

const COOKIE = "unemploy_session";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function createSession(userId: string) {
  const id = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db.insert(schema.sessions).values({ id, userId, expiresAt });
  (await cookies()).set(COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) await db.delete(schema.sessions).where(eq(schema.sessions.id, id));
  jar.delete(COOKIE);
}

export const getCurrentUser = cache(async () => {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id) return null;
  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, id) });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return (await db.query.users.findFirst({ where: eq(schema.users.id, session.userId) })) ?? null;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return user;
}
