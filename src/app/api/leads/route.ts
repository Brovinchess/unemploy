import { NextResponse, after } from "next/server";
import { noteRejectedKey, profileForKey } from "@/lib/keys";
import { sendFreshKey } from "@/lib/search";
import { poolFor, poolText } from "@/lib/pool";

// Rung 0 of every search ("check first" in the request): postings seen open recently that may fit
// this person, read from the shared pool. The address never says "pool": the Mind's chat is visible to the person. Plain text,
// so the Mind reads it cheaply. Same key as the ingest endpoint.
export const maxDuration = 60; // the list is link-checked before it goes out

export async function GET(request: Request) {
  const key = request.headers.get("x-unemploy-key");
  const found = key ? await profileForKey(key) : null;
  const profile = found?.profile ?? null;
  if (!profile) {
    console.warn(`[leads] unknown key ${key ? `${key.slice(0, 4)}… (${key.length} chars)` : "(none)"}${found?.owner ? `, looks like ${found.owner.id}` : ""}`);
    if (found?.owner && (await noteRejectedKey(found.owner))) after(() => sendFreshKey(found.owner!, "The key you just used was refused.").catch((e) => console.error("[leads] fresh key", e)));
    return NextResponse.json({ code: "unknown_key", hint: 'Send the key from your latest brief, or from the latest message that gave you one, in the "x-unemploy-key" header. If you have neither, reply in chat with the words KEY LOST and stop; a new one will be sent.' }, { status: 401 });
  }
  const rows = await poolFor(profile).catch((e) => (console.error("[pool]", e), []));
  return new NextResponse(poolText(rows), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
