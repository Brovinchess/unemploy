"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

// Ties this browser's page views to the signed-in user, so the funnel reads as one person.
export function AnalyticsIdentity({ id, username }: { id: string; username: string | null }) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    posthog.identify(id, username ? { username } : undefined);
  }, [id, username]);
  return null;
}
