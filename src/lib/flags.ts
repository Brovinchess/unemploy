// Feature switches. Public so client components can read them; set in Vercel to flip.
// The Chrome extension stays "coming soon" on production until it's in the Web Store.
export const extensionLive = process.env.NEXT_PUBLIC_EXTENSION_LIVE === "1";
