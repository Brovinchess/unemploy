import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Resumes up to 5 MB are uploaded through a Server Action.
    serverActions: { bodySizeLimit: "6mb" },
  },
  // One address for the site. www answers on its own at Vercel, and search engines would count
  // it as a second copy of every page; send it to the bare domain for good.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.careerninja.app" }],
        destination: "https://careerninja.app/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
