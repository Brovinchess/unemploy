import { NextResponse } from "next/server";

// The retired personal Mind used to send its answers here. The headhunter now answers form
// questions itself, so anything still posting is told to stop.
const gone = () =>
  NextResponse.json({ code: "retired", hint: "This address is no longer in use. Stop; there is nothing more to send." }, { status: 410 });

export const GET = gone;
export const POST = gone;
