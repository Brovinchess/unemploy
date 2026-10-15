import "server-only";
import { notFound, redirect } from "next/navigation";
import { mindsConfig } from "./minds/config";
import { getCurrentUser } from "./session";

// Who may open admin.careerninja.app. Usernames, comma separated, in ADMIN_USERS; the owner by default.
const ADMINS = new Set((process.env.ADMIN_USERS ?? "rovinc").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
export const isAdmin = (username: string | null | undefined) => !!username && ADMINS.has(username.toLowerCase());

// Signed-out visitors go to the main site to sign in (the session cookie covers the admin
// subdomain, so they can come back); signed-in non-admins see a 404, not a hint.
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect(`${mindsConfig.appUrl}/auth/login`);
  if (!isAdmin(user.username)) notFound();
  return user;
}

export const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
export const when = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 16).replace("T", " ") : "");
export const mins = (a: Date, b: Date | null) => (b ? Math.max(1, Math.round((b.getTime() - a.getTime()) / 60_000)) : null);
export function tally<T>(rows: T[], key: (r: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
