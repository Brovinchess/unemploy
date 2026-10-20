import type { MetadataRoute } from "next";
import { mindsConfig } from "@/lib/minds/config";

// Search engines may index the public pages only; the app, admin and API stay out.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/how-it-works", "/extension", "/privacy"], disallow: ["/app", "/admin", "/api", "/auth", "/start", "/profiles", "/r/"] }],
    sitemap: `${mindsConfig.appUrl}/sitemap.xml`,
  };
}
