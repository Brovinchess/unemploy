import { ImageResponse } from "next/og";

// The picture shown when the site is shared on X, LinkedIn, WhatsApp and the like.
export const alt = "Career Ninja, your own AI headhunter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  // The mascot as a plain picture (public/mochi.svg, pre-rendered from the Ninja component):
  // the image renderer takes only simple elements, not React components.
  const site = process.env.NODE_ENV === "development" ? "http://localhost:3000" : process.env.APP_URL || "https://careerninja.app";
  const mascot = `${site}/mochi.svg`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "72px 88px",
          background: "linear-gradient(135deg, #141b22 0%, #1b232d 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 720 }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 34, fontWeight: 700, letterSpacing: -0.5 }}>
            careerninja<span style={{ color: "#c96567" }}>.</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 44, fontSize: 64, fontWeight: 600, lineHeight: 1.08, letterSpacing: -1.5 }}>
            <span>Stop scrolling job boards.</span>
            <span style={{ color: "rgba(255,255,255,0.7)" }}>Your own headhunter</span>
            <span style={{ color: "#c96567" }}>writes every application.</span>
          </div>
          <div style={{ display: "flex", marginTop: 36, fontSize: 26, color: "rgba(255,255,255,0.6)", lineHeight: 1.4 }}>
            Real, open jobs you&rsquo;d get. The application written from your resume. You press Submit.
          </div>
        </div>
        <div style={{ display: "flex", width: 300, height: 300 }}>
          <img src={mascot} width={300} height={300} alt="" />
        </div>
      </div>
    ),
    size,
  );
}
