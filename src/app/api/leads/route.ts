import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashKey } from "@/lib/keys";
import { poolFor, poolText } from "@/lib/pool";

// Rung 0 of every search ("check first" in the request): postings seen open recently that may fit
// this person, read from the shared pool. The address never says "pool": the Mind's chat is visible to the person. Plain text,
// so the Mind reads it cheaply. Same key as the ingest endpoint.
export const maxDuration = 60; // the list is link-checked before it goes out

export async function GET(request: Request) {
  const key = request.headers.get("x-unemploy-key");
  const profile = key ? await db.query.profiles.findFirst({ where: eq(schema.profiles.ingestKeyHash, hashKey(key)) }) : null;
  if (!profile) return NextResponse.json({ code: "unknown_key", hint: 'Send the key from your brief in the "x-unemploy-key" header.' }, { status: 401 });
  const rows = await poolFor(profile).catch((e) => (console.error("[pool]", e), []));
  return new NextResponse(poolText(rows), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
