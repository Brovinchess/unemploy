import posthog from "posthog-js";

// Product analytics (PostHog): page views, and the events the app sends from the browser.
// Does nothing when no key is set, so local runs and previews stay quiet.
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (key) {
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    defaults: "2026-05-30",
    person_profiles: "identified_only",
  });
}
