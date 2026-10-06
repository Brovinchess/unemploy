// "Apply to all": opens each To-apply job's form in turn, lets the page script fill it,
// and moves on when the company confirms the application (or the person skips it).

const get = (keys) => chrome.storage.local.get(keys);
const set = (obj) => chrome.storage.local.set(obj);

let queue = null; // last fetched queue (kept in memory; re-fetched if the worker restarts)

async function api(path, init = {}) {
  const { token, apiBase } = await get(["token", "apiBase"]);
  if (!token || !apiBase) throw new Error("not_connected");
  const res = await fetch(apiBase + path, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (res.status === 401) {
    await chrome.storage.local.remove(["token"]);
    throw new Error("not_connected");
  }
  return res.json();
}

async function loadQueue() {
  queue = await api("/api/extension/queue");
  return queue;
}

async function status() {
  const { token, apiBase, run, mode } = await get(["token", "apiBase", "run", "mode"]);
  if (!token) return { connected: false, mode: mode || "review" };
  try {
    const q = await loadQueue();
    return {
      connected: true,
      apiBase,
      user: q.user,
      detailsComplete: q.detailsComplete,
      waiting: q.jobs.length,
      supported: q.jobs.filter((j) => j.supported).length,
      running: !!run?.active,
      run,
      mode: mode || "review",
    };
  } catch (e) {
    return { connected: false, error: String(e.message || e), mode: mode || "review" };
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
  await set({ run: { active: true, ids: jobs.map((j) => j.id), index: 0, done: [], skipped: [], tabId: null } });
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
  await set({ run });
  badge(`${run.index + 1}/${run.ids.length}`);
}

async function advance(kind) {
  const { run } = await get(["run"]);
  if (!run?.active) return;
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
}

async function finish() {
  const { run, apiBase } = await get(["run", "apiBase"]);
  await set({ run: { ...run, active: false } });
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
        await set({ token: msg.token, apiBase: msg.apiBase });
        return { ok: true };
      case "disconnect":
        await chrome.storage.local.remove(["token", "run"]);
        return { ok: true };
      case "setMode":
        await set({ mode: msg.mode });
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
        return {
          job,
          applicant: queue.applicant,
          savedAnswers: queue.savedAnswers || [],
          resume: job ? queue.resumes[job.resume] : null,
          mode: mode || "review",
          position: run.index + 1,
          total: run.ids.length,
        };
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
        return advance("done");
      case "skip":
        return advance("skip");
    }
  })().then(sendResponse, (e) => sendResponse({ error: String(e?.message || e) }));
  return true;
});
