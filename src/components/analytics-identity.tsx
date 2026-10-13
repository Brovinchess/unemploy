"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

// Accounts that belong to the team: PostHog's "Internal / Test users" cohort picks them up
// through this person property, so their activity stays out of every chart.
const INTERNAL = new Set(["rovinc"]);

// Ties this browser's page views to the signed-in user, so the funnel reads as one person.
export function AnalyticsIdentity({ id, username }: { id: string; username: string | null }) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    posthog.identify(id, { ...(username ? { username } : {}), $internal_or_test_user: !!username && INTERNAL.has(username) });
  }, [id, username]);
  return null;
}
