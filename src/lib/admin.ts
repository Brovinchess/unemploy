// Only the usernames in ADMIN_USERNAMES (comma separated) can open /admin pages.
export function isAdmin(username: string | null | undefined) {
  const list = (process.env.ADMIN_USERNAMES ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return !!username && list.includes(username.toLowerCase());
}
