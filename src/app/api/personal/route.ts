import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashKey } from "@/lib/keys";
import { processAnswers } from "@/lib/personal";

// Where the personal Mind sends its answers to form questions.
export async function GET() {
  return NextResponse.json({ hint: 'POST {"answers":[{"id":"...","answer":"..." or null,"note":"..."}]} with your x-unemploy-key header.' });
}

export async function POST(request: Request) {
  const key = request.headers.get("x-unemploy-key");
  const user = key ? await db.query.users.findFirst({ where: eq(schema.users.personalKeyHash, hashKey(key)) }) : null;
  if (!user) {
    return NextResponse.json({ code: "unknown_key", hint: 'Send the key from your brief in the "x-unemploy-key" header.' }, { status: 401 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > 300_000) {
    return NextResponse.json({ code: "too_large", hint: "Send at most 300 KB." }, { status: 413 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "bad_json", hint: "Body must be JSON." }, { status: 400 });
  }
  const result = await processAnswers(user, body);
  console.log(`[personal] ${user.personalMindName}: ${result.ok ? `saved ${result.saved}, unknown ${result.unknown}` : "bad body"}`);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
