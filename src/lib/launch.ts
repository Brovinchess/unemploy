// Before launch the landing page collects waitlist sign-ups and hides sign-in.
// Set LAUNCH_MODE=open to show "Get started" and let anyone sign in.
export const launchMode: "waitlist" | "open" = process.env.LAUNCH_MODE === "open" ? "open" : "waitlist";
