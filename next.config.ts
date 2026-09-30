import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Resumes up to 5 MB are uploaded through a Server Action.
    serverActions: { bodySizeLimit: "6mb" },
  },
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
