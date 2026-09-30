import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { buildContract } from "@/lib/brief";
import { hashKey } from "@/lib/keys";
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
  const profile = await db.query.profiles.findFirst({ where: eq(schema.profiles.ingestKeyHash, hashKey(key)) });
  if (!profile) {
    console.warn("[ingest] unknown key");
    return NextResponse.json(
      { code: "unknown_key", hint: "That key is not recognised. Use the exact key from your latest brief." },
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
  return NextResponse.json(result, { status: result.accepted || dryRun || result.searchEnded ? 200 : 422 });
}
