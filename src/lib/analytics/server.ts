import "server-only";
import { PostHog } from "posthog-node";

// Server-side events, keyed by our user id, so the funnel (signed in → resume → deployed →
// first search → first swipe) is counted where it actually happens. Fire and forget: analytics
// must never slow or break an action. Silent when no key is set.
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const client = key ? new PostHog(key, { host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com", flushAt: 1, flushInterval: 0 }) : null;

export type Event =
  | "signed_in"
  | "username_saved"
  | "resume_uploaded"
  | "headhunter_deployed"
  | "search_requested"
  | "search_finished"
  | "card_decided"
  | "personal_mind_deployed"
  | "headhunter_removed";

export const analyticsOn = !!client;

export function track(userId: string, event: Event, properties: Record<string, string | number | boolean | null | undefined> = {}, timestamp?: Date) {
  if (!client) return;
  try {
    client.capture({ distinctId: userId, event, properties, ...(timestamp ? { timestamp } : {}) });
    void client.flush().catch(() => {});
  } catch {
    // never let analytics fail an action
  }
}
