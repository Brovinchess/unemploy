// "Apply to all": opens each To-apply job's form in turn, lets the page script fill it,
// and moves on when the person confirms the application (or skips it).

const get = (keys) => chrome.storage.local.get(keys);
const set = (obj) => chrome.storage.local.set(obj);

let queue = null; // last fetched queue (kept in memory; re-fetched if the worker restarts)

class NotConnected extends Error {}

async function api(path, init = {}) {
  const { token, apiBase } = await get(["token", "apiBase"]);
  if (!token || !apiBase) throw new NotConnected("not_connected");
  const res = await fetch(apiBase + path, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (res.status === 401) {
    await chrome.storage.local.remove(["token", "run"]);
    throw new NotConnected("not_connected");
  }
  if (!res.ok) throw new Error(`http_${res.status}`);
  return res.json();
}

const loadQueue = async () => (queue = await api("/api/extension/queue"));

// Light: counts only. The popup and every app page ask for this.
async function status() {
  const { token, apiBase, run, mode, lastRun } = await get(["token", "apiBase", "run", "mode", "lastRun"]);
  const base = { mode: mode || "review", lastRun: lastRun || null };
  if (!token) return { ...base, connected: false };
  try {
    const s = await api("/api/extension/status");
    return {
      ...base,
      connected: true,
      apiBase,
      user: s.user,
      detailsComplete: s.detailsComplete,
      waiting: s.waiting,
      supported: s.supported,
      minVersion: s.minVersion,
      running: !!run?.active,
      run,
    };
  } catch (e) {
    if (e instanceof NotConnected) return { ...base, connected: false };
    // Signed in, but the app can't be reached right now: say so instead of asking to connect again.
    return { ...base, connected: true, unreachable: true, apiBase, running: !!run?.active, run };
  }
}

async function applyAll(mode) {
  if (mode) await set({ mode });
  const q = await loadQueue();
  const { apiBase } = await get(["apiBase"]);
  if (!q.detailsComplete) {
    chrome.tabs.create({ url: `${apiBase}/app/you#application` });
    return { ok: false, reason: "details" };
  }
  const jobs = q.jobs.filter((j) => j.supported);
  if (!jobs.length) return { ok: false, reason: "empty" };
  await set({ run: { active: true, ids: jobs.map((j) => j.id), index: 0, done: [], skipped: [], tabId: null, submitClicked: false }, lastRun: null });
  await openCurrent();
  return { ok: true, count: jobs.length };
}

async function openCurrent() {
  const { run } = await get(["run"]);
  if (!run?.active) return;
  if (run.index >= run.ids.length) return finish();
  if (!queue) await loadQueue();
  const job = queue.jobs.find((j) => j.id === run.ids[run.index]);
  if (!job) {
    run.index++;
    await set({ run });
    return openCurrent();
  }
  const tab = await chrome.tabs.create({ url: job.applyUrl, active: true });
  run.tabId = tab.id;
  run.submitClicked = false;
  await set({ run });
  badge(`${run.index + 1}/${run.ids.length}`);
}

// Only the tab we opened for the current job may move the run on, and only once.
async function advance(kind, sender) {
  const { run } = await get(["run"]);
  if (!run?.active || !run.tabId || sender?.tab?.id !== run.tabId) return { ok: false };
  const id = run.ids[run.index];
  if (kind === "done") {
    run.done.push(id);
    await api("/api/extension/applied", { method: "POST", body: JSON.stringify({ jobId: id }) }).catch(() => {});
  } else run.skipped.push(id);
  const old = run.tabId;
  run.index++;
  run.tabId = null;
  await set({ run });
  if (old) setTimeout(() => chrome.tabs.remove(old).catch(() => {}), kind === "done" ? 2500 : 300);
  await openCurrent();
  return { ok: true };
}

async function finish() {
  const { run, apiBase } = await get(["run", "apiBase"]);
  await set({ run: { ...run, active: false }, lastRun: { done: run?.done?.length ?? 0, skipped: run?.skipped?.length ?? 0, at: Date.now() } });
  badge("");
  chrome.tabs.create({ url: `${apiBase}/app?applied=${run?.done?.length ?? 0}` });
}

function badge(text) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: "#c96567" });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case "status":
        return status();
      case "connect":
        // Only our own page script can hand over a token (see content_scripts in the manifest).
        if (!sender.tab || !/^https:\/\/careerninja\.app$|^http:\/\/localhost:3000$/.test(msg.apiBase || "")) return { ok: false };
        await set({ token: msg.token, apiBase: msg.apiBase });
        return { ok: true };
      case "disconnect":
        await api("/api/extension/token", { method: "DELETE" }).catch(() => {});
        await chrome.storage.local.remove(["token", "run", "lastRun"]);
        queue = null;
        return { ok: true };
      case "setMode":
        await set({ mode: msg.mode === "auto" ? "auto" : "review" });
        return { ok: true };
      case "dismissLastRun":
        await chrome.storage.local.remove(["lastRun"]);
        return { ok: true };
      case "applyAll":
        return applyAll(msg.mode);
      case "stop": {
        const { run } = await get(["run"]);
        await set({ run: { ...run, active: false } });
        badge("");
        return { ok: true };
      }
      // From the job page: is this tab part of a run, and with what?
      case "whatToFill": {
        const { run, mode } = await get(["run", "mode"]);
        if (!run?.active || run.tabId !== sender.tab?.id) return { job: null };
        if (!queue) await loadQueue();
        const job = queue.jobs.find((j) => j.id === run.ids[run.index]);
        // The resume file is fetched per job, not with every status check.
        const resume = job && queue.resumes?.[job.resume] ? await api(`/api/extension/resume?profile=${job.resume}`).catch(() => null) : null;
        return {
          job,
          applicant: queue.applicant,
          savedAnswers: queue.savedAnswers || [],
          resume,
          mode: mode || "review",
          position: run.index + 1,
          total: run.ids.length,
          submitClicked: !!run.submitClicked,
        };
      }
      case "submitClicked": {
        const { run } = await get(["run"]);
        if (run?.active && run.tabId === sender.tab?.id) await set({ run: { ...run, submitClicked: true } });
        return { ok: true };
      }
      case "learn": {
        // Use them straight away for the rest of this run, and keep them for next time.
        if (queue) {
          const key = (q) => q.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
          const map = new Map((queue.savedAnswers || []).map((a) => [key(a.question), a]));
          msg.answers.forEach((a) => map.set(key(a.question), a));
          queue.savedAnswers = [...map.values()];
        }
        return api("/api/extension/answers", { method: "POST", body: JSON.stringify({ answers: msg.answers }) }).catch(() => null);
      }
      case "submitted":
        return advance("done", sender);
      case "skip":
        return advance("skip", sender);
    }
  })().then(sendResponse, (e) => sendResponse({ error: String(e?.message || e) }));
  return true;
});
