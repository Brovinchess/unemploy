import { NextResponse } from "next/server";
import { bearerToken, revokeExtensionToken } from "@/lib/extension";

// "Disconnect" in the extension: the token it holds stops working.
export async function DELETE(request: Request) {
  await revokeExtensionToken(bearerToken(request));
  return NextResponse.json({ ok: true });
}
