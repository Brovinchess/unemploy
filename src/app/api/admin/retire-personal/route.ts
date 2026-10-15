import { NextResponse } from "next/server";
import { inArray, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { minds } from "@/lib/minds/client";
import { getCurrentUser } from "@/lib/session";

// One-off cutover, owner only: switch off every personal Mind and hand its unanswered
// questions to the person. Remove after it has run on production.
export async function POST() {
  const me = await getCurrentUser();
  if (me?.username !== "rovinc") return NextResponse.json({ error: "not found" }, { status: 404 });
  const owners = await db.query.users.findMany({ where: isNotNull(schema.users.personalMindId) });
  const off: string[] = [];
  for (const u of owners) {
    await minds(u)
      .setEnabled(u.personalMindId!, false)
      .then(() => off.push(u.personalMindName ?? u.personalMindId!))
      .catch((e) => console.error("[retire] couldn't switch off", u.personalMindName, e));
  }
  const moved = await db
    .update(schema.questions)
    .set({ status: "needs_you", askedAt: null })
    .where(inArray(schema.questions.status, ["new", "asked"]))
    .returning({ id: schema.questions.id });
  return NextResponse.json({ mindsOff: off, questionsMoved: moved.length });
}
