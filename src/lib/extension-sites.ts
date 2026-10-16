// The job systems the Chrome extension can fill forms on. Pure, so client components can tell
// "the extension applies" from "apply yourself". Mirrors extension/manifest.json host permissions.
export const SUPPORTED_HOSTS = ["boards.greenhouse.io", "job-boards.greenhouse.io", "jobs.lever.co", "jobs.eu.lever.co", "jobs.ashbyhq.com"];
export const isSupported = (url: string) => {
  try {
    const h = new URL(url).hostname;
    return SUPPORTED_HOSTS.some((s) => h === s || h.endsWith(`.${s}`));
  } catch {
    return false;
  }
};
