// Runs on Career Ninja pages. Lets the web app see that the extension is installed,
// hand it a sign-in token, and start "Apply to all".
document.documentElement.dataset.careerNinjaExtension = chrome.runtime.getManifest().version;

window.addEventListener("message", async (e) => {
  if (e.source !== window || e.data?.source !== "careerninja-app") return;
  const reply = (payload) => window.postMessage({ source: "careerninja-ext", id: e.data.id, ...payload }, location.origin);
  const { type } = e.data;
  if (type === "hello") {
    const status = await chrome.runtime.sendMessage({ type: "status" });
    reply({ type: "hello", version: chrome.runtime.getManifest().version, ...status });
  } else if (type === "connect") {
    await chrome.runtime.sendMessage({ type: "connect", token: e.data.token, apiBase: location.origin });
    reply({ type: "connected" });
  } else if (type === "applyAll") {
    const r = await chrome.runtime.sendMessage({ type: "applyAll", mode: e.data.mode });
    reply({ type: "started", ...r });
  }
});
