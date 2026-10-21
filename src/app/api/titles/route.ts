import { NextResponse } from "next/server";
import { suggestTitles } from "@/lib/title-suggest";

// Job-title suggestions for the roles field and the no-resume setup. Public, cached, no personal data.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const titles = suggestTitles(q.slice(0, 60));
  return NextResponse.json(titles, { headers: { "cache-control": "public, max-age=86400, s-maxage=86400" } });
}
