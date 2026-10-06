import { NextResponse } from "next/server";
import { z } from "zod";
import { extensionUser, saveAnswers } from "@/lib/extension";

const body = z.object({
  answers: z.array(z.object({ question: z.string().max(400), answer: z.string().max(2000) })).max(50),
});

// Answers the person typed into a form the extension couldn't fill, to reuse next time.
export async function POST(request: Request) {
  const user = await extensionUser(request);
  if (!user) return NextResponse.json({ error: "not_connected" }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_body" }, { status: 400 });
  const savedAnswers = await saveAnswers(user, parsed.data.answers);
  return NextResponse.json({ ok: true, saved: savedAnswers.length });
}
