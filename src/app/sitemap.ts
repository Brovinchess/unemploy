import type { MetadataRoute } from "next";
import { mindsConfig } from "@/lib/minds/config";

// The public pages. Everything else needs a sign-in.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = mindsConfig.appUrl;
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/how-it-works`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/extension`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/privacy`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
