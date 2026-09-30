import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Home-screen icon for iOS, which ignores SVG favicons: Mochi on the night background.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const svg = await readFile(join(process.cwd(), "src/app/icon.svg"), "utf8");
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#141b22" }}>
        <img src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`} width={132} height={124} alt="" />
      </div>
    ),
    size,
  );
}
