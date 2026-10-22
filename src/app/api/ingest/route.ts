import { NextResponse, after } from "next/server";
import { buildContract } from "@/lib/brief";
import { noteRejectedKey, profileForKey } from "@/lib/keys";
import { sendFreshKey } from "@/lib/search";
import { processPush } from "@/lib/ingest";
import { mindsConfig } from "@/lib/minds/config";

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get("brief") === "1") {
    return new NextResponse(buildContract(mindsConfig.ingestUrl), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return NextResponse.json({ hint: "POST jobs here. Read the format at GET /api/ingest?brief=1" });
}

export async function POST(request: Request) {
  const key = request.headers.get("x-unemploy-key");
  if (!key) {
    return NextResponse.json(
      { code: "missing_key", hint: 'Send the key from your brief in the "x-unemploy-key" header.' },
      { status: 401 },
    );
  }
  const found = await profileForKey(key);
  const profile = found.profile;
  if (!profile) {
    console.warn(`[ingest] unknown key ${key.slice(0, 4)}… (${key.length} chars)${found.owner ? `, looks like ${found.owner.id}` : ""}`);
    if (found.owner && (await noteRejectedKey(found.owner))) after(() => sendFreshKey(found.owner!, "The key you just used was refused.").catch((e) => console.error("[ingest] fresh key", e)));
    return NextResponse.json(
      { code: "unknown_key", hint: "That key is not recognised. Use the exact key from your latest brief or the latest message that gave you one. If you have neither, reply in chat with the words KEY LOST and stop; a new one will be sent." },
      { status: 401 },
    );
  }

  if (Number(request.headers.get("content-length") ?? 0) > 1_000_000) {
    return NextResponse.json({ code: "too_large", hint: "Send at most 1 MB per push. Split jobs across pushes." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "bad_json", hint: "Body must be JSON." }, { status: 400 });
  }

  const dryRun = new URL(request.url).searchParams.get("dry_run") === "1";
  const result = await processPush(profile, body, { dryRun });
  console.log(`[ingest] ${profile.mindName}: accepted ${result.accepted}, rejected ${result.rejected.length}${dryRun ? " (dry run)" : ""}`);
  return NextResponse.json(result, { status: result.accepted || result.packsAccepted || dryRun || result.searchEnded || result.droppedRecorded ? 200 : 422 });
}
