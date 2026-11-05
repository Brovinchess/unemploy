import { NextResponse, after } from "next/server";
import { noteRejectedKey, profileForKey } from "@/lib/keys";
import { sendFreshKey } from "@/lib/search";
import { boardText, postingText, readBoard, readPosting, recordPosting, saveBoardPostings, sourceOf, splitBoard } from "@/lib/boards";
import { roleWords } from "@/lib/pool";
import { track } from "@/lib/analytics/server";

// An employer's careers page, read by Career Ninja for the Mind (see lib/boards): the whole board
// as plain text, jobs that may fit first, then every other title, in pages small enough that the
// Mind reads them without paying for a file. A single job link from a job system comes back as
// that posting's text, or as closed. Same key as the ingest endpoint.
export const maxDuration = 60;

const text = (body: string, status = 200) => new NextResponse(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });

export async function GET(request: Request) {
  const key = request.headers.get("x-unemploy-key");
  const found = key ? await profileForKey(key) : null;
  const profile = found?.profile ?? null;
  if (!profile) {
    console.warn(`[careers] unknown key ${key ? `${key.slice(0, 4)}… (${key.length} chars)` : "(none)"}${found?.owner ? `, looks like ${found.owner.id}` : ""}`);
    if (found?.owner && (await noteRejectedKey(found.owner))) after(() => sendFreshKey(found.owner!, "The key you just used was refused.").catch((e) => console.error("[careers] fresh key", e)));
    return NextResponse.json({ code: "unknown_key", hint: 'Send the key from your latest brief, or from the latest message that gave you one, in the "x-unemploy-key" header. If you have neither, reply in chat with the words KEY LOST and stop; a new one will be sent.' }, { status: 401 });
  }
  const query = new URL(request.url).searchParams;
  const link = query.get("url") ?? "";
  const page = Number(query.get("page") ?? 1) || 1;
  const src = sourceOf(link);
  if (!src) return text(`Career Ninja can't read that link (${link ? "not a public careers page" : "no url given"}). Pass the careers page as ?url=..., or open it yourself if it is a careers page.`, 400);

  const started = Date.now();
  if (src.system !== "page" && src.job) {
    const job = { ...src, job: src.job };
    try {
      const posting = await readPosting(job);
      if (posting.fetchedAt >= started) after(() => recordPosting(posting, src.system, link).catch((e) => console.error("[careers] save posting", e)));
      track(profile.userId, "careers_read", { system: src.system, ok: true, kind: "job", closed: posting.closed, cached: posting.fetchedAt < started });
      return text(postingText(posting, src.system, link));
    } catch (e) {
      console.warn(`[careers] ${src.system} job read failed`, link, String(e).slice(0, 120));
      track(profile.userId, "careers_read", { system: src.system, ok: false, kind: "job" });
      return text(`Career Ninja could not read this job just now (${src.system}). Open it yourself as usual.`);
    }
  }

  const words = profile.preferences ? roleWords(profile.preferences) : [];
  let board;
  try {
    board = await readBoard(src, words);
  } catch (e) {
    console.warn(`[careers] ${src.system} read failed`, link, String(e).slice(0, 120));
    track(profile.userId, "careers_read", { system: src.system, ok: false });
    return text(`Career Ninja could not read this careers page just now (${src.system}). Open it yourself as usual.`);
  }
  if (!board.jobs.length && !board.text) {
    track(profile.userId, "careers_read", { system: src.system, ok: true, jobs: 0 });
    return text(`Career Ninja read ${board.company}'s careers page and found no open jobs listed. If the page looks different to you, open it yourself.`);
  }
  const { fits, rest } = splitBoard(board, profile);
  const body = boardText(board, fits, rest, page);
  const fresh = board.fetchedAt >= started;
  if (fresh) after(() => saveBoardPostings(board).catch((e) => console.error("[careers] save", e)));
  track(profile.userId, "careers_read", { system: src.system, ok: true, jobs: board.total, fits: fits.length, bytes: body.length, page, cached: !fresh });
  return text(body);
}
