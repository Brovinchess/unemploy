import { after, NextResponse, type NextRequest } from "next/server";
import { buildActivity } from "@/lib/activity";
import { nudgeIfQuiet } from "@/lib/search";
import { ownedProfile } from "@/lib/owned";
import { requireUser } from "@/lib/session";

// Polled by the activity feed on the shortlist page.
export async function GET(req: NextRequest) {
  const user = await requireUser();
  const id = req.nextUrl.searchParams.get("profile") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "profile required" }, { status: 400 });
  const profile = await ownedProfile(user, id);
  const activity = await buildActivity(user, profile);
  after(() => nudgeIfQuiet(profile).catch((e) => console.error("[activity] nudge", e)));
  return NextResponse.json({ ...activity, lastDeliveryAt: profile.lastDeliveryAt?.toISOString() ?? null }, { headers: { "Cache-Control": "no-store" } });
}
