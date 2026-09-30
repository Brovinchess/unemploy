import "server-only";

export const BUILDER_API = "https://api.build.hellominds.ai";
export const OAUTH_API = "https://api.oauth.hellominds.ai";

export const OAUTH_SCOPES = [
  "minds:list",
  "minds:status",
  "minds:cognition",
  "minds:awaken",
  "minds:enable",
  "minds:disable",
  "conversations:create",
  "conversations:read",
  "messaging:send",
  "messaging:beacon",
  "messaging:history",
];

// Without an OAuth client id the app runs against a simulated Mind, so the whole
// journey can be tried locally without spending cognition.
export const mindsMode: "live" | "mock" =
  process.env.HM_MODE === "mock" || !process.env.HM_CLIENT_ID ? "mock" : "live";

export const mindsConfig = {
  clientId: process.env.HM_CLIENT_ID ?? "",
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  archetype: process.env.HM_ARCHETYPE ?? "research",
  topUpUrl: process.env.HM_TOPUP_URL ?? "https://hellominds.ai",
};

export function redirectUri() {
  return `${mindsConfig.appUrl}/auth/callback`;
}
