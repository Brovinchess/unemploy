import { NextResponse } from "next/server";
import { accessTokenFor } from "@/lib/minds/client";
import { getCurrentUser } from "@/lib/session";

// Temporary, admin-only, read-only: does the user's OAuth token work against the user-facing
// Hello Minds API (default Mind, referral tags)? Removed once we know.
export async function GET() {
  const user = await getCurrentUser();
  const admins = (process.env.ADMIN_USERNAMES ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!user?.username || !admins.includes(user.username.toLowerCase())) return NextResponse.json({ error: "not found" }, { status: 404 });
  const token = await accessTokenFor(user);
  const out: Record<string, unknown> = {};
  for (const path of ["/v1/minds/primary-mind", "/v1/referral/tags/hellominds", "/v1/humans/me"]) {
    try {
      const r = await fetch(`https://api.hellominds.ai${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store" });
      out[path] = { status: r.status, body: (await r.text()).slice(0, 300) };
    } catch (e) {
      out[path] = { error: String(e) };
    }
  }
  return NextResponse.json(out);
}
