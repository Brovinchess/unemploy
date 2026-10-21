import posthog from "posthog-js";

// Starts PostHog in the browser before the page hydrates: page views (including client-side
// navigation), clicks and the standard web vitals. Server actions send their own events with
// the same key, so both halves land in one project. Silent without a key.
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (key) {
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    capture_pageview: "history_change",
    capture_pageleave: true,
    person_profiles: "identified_only",
    // Session recordings show layout and clicks only: every word on screen and everything typed
    // is masked before it leaves the browser. Errors are captured with the session they hit.
    session_recording: { maskAllInputs: true, maskTextSelector: "*" },
    capture_exceptions: true,
  });
}
