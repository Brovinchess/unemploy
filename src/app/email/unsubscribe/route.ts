import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { verifyUnsubscribe } from "@/lib/email";

// One click from the foot of an email turns updates off. No sign-in needed; the link is signed.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const u = url.searchParams.get("u") ?? "", t = url.searchParams.get("t") ?? "";
  const okToken = /^[0-9a-f-]{36}$/i.test(u) && t.length === 24 && verifyUnsubscribe(u, t);
  if (okToken) await db.update(schema.users).set({ emailOnSearchDone: false }).where(eq(schema.users.id, u));
  const body = okToken
    ? "<h1>Done</h1><p>You won't get emails from Career Ninja. You can turn them back on any time in Settings.</p>"
    : "<h1>That link didn't work</h1><p>Open Career Ninja and turn emails off in Settings instead.</p>";
  return new Response(`<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Career Ninja</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#141b22;color:#c4ccd4;font-family:Inter,-apple-system,Segoe UI,sans-serif;text-align:center;padding:24px}h1{color:#fff;font-size:22px;margin:0 0 8px}a{color:#e08a8c}</style></head><body><div>${body}<p><a href="/app/settings">Open Settings</a></p></div></body></html>`, { status: okToken ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
