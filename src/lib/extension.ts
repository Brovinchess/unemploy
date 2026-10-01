import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ApplicantDetails } from "@/db/schema";
import { hashKey } from "./keys";

// The Chrome extension authenticates with a token the signed-in web app hands it.
export async function createExtensionToken(userId: string) {
  const token = `cx_${randomBytes(24).toString("base64url")}`;
  await db.insert(schema.extensionTokens).values({ userId, tokenHash: hashKey(token) });
  return token;
}

export async function extensionUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token?.startsWith("cx_")) return null;
  const row = await db.query.extensionTokens.findFirst({ where: eq(schema.extensionTokens.tokenHash, hashKey(token)) });
  if (!row) return null;
  await db.update(schema.extensionTokens).set({ lastUsedAt: new Date() }).where(eq(schema.extensionTokens.id, row.id));
  return db.query.users.findFirst({ where: eq(schema.users.id, row.userId) });
}

export const REQUIRED_DETAILS: (keyof ApplicantDetails)[] = ["firstName", "lastName", "email", "phone", "location"];
export const detailsComplete = (d: ApplicantDetails | null | undefined) => !!d && REQUIRED_DETAILS.every((k) => !!d[k]?.trim());

// Where the application form lives for each job system the extension supports.
export function applyUrl(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname === "jobs.lever.co" && !u.pathname.endsWith("/apply")) u.pathname = u.pathname.replace(/\/$/, "") + "/apply";
    if (u.hostname === "jobs.ashbyhq.com" && !u.pathname.endsWith("/application")) u.pathname = u.pathname.replace(/\/$/, "") + "/application";
    return u.toString();
  } catch {
    return url;
  }
}

export const SUPPORTED_HOSTS = ["greenhouse.io", "jobs.lever.co", "jobs.ashbyhq.com"];
export const isSupported = (url: string) => {
  try {
    const h = new URL(url).hostname;
    return SUPPORTED_HOSTS.some((s) => h === s || h.endsWith(`.${s}`));
  } catch {
    return false;
  }
};
