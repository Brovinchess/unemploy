import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Resumes up to 5 MB are uploaded through a Server Action.
    serverActions: { bodySizeLimit: "6mb" },
  },
  serverExternalPackages: ["@libsql/client", "libsql"],
  // Migrations are read from disk at startup, so ship them with every function.
  outputFileTracingIncludes: { "/**": ["./drizzle/**"] },
};

export default nextConfig;
