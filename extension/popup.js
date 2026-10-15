const el = document.getElementById("body");
const send = (m) => chrome.runtime.sendMessage(m);
const h = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "on") Object.assign(n, v);
    else if (k === "class") n.className = v;
    else n.setAttribute(k, v);
  }
  n.append(...kids);
  return n;
};
const p = (text, cls) => h("p", cls ? { class: cls } : {}, text);
const show = (...nodes) => el.replaceChildren(...nodes);

async function render() {
  const s = await send({ type: "status" });

  if (!s.connected) {
    return show(
      p("Connect the extension to your Career Ninja account to fill applications for you."),
      h("a", { class: "btn", href: "https://careerninja.app/app/settings#extension", target: "_blank", rel: "noopener" }, "Connect"),
    );
  }
  if (s.unreachable) {
    return show(
      p("Can't reach Career Ninja right now. Check your connection and try again."),
      h("button", { class: "g", on: { onclick: render } }, "Try again"),
    );
  }
  if (s.running) {
    return show(
      h("div", { class: "big" }, `${s.run.index + 1} / ${s.run.ids.length}`),
      p(s.mode === "auto" ? "Applying now. Each form is sent after a 5-second countdown you can cancel." : "Applying now. Check each form, then press its Submit button."),
      h("button", { class: "g", on: { onclick: async () => (await send({ type: "stop" }), render()) } }, "Stop"),
    );
  }

  const nodes = [];
  if (s.lastRun) {
    nodes.push(
      h("div", { class: "done" }, p(`Last run: ${s.lastRun.done} applied, ${s.lastRun.skipped} skipped.`), h("a", { href: "#", on: { onclick: async (e) => (e.preventDefault(), await send({ type: "dismissLastRun" }), render()) } }, "Dismiss")),
    );
  }
  const other = s.waiting > s.supported ? ` (${s.waiting - s.supported} on other sites, apply from the app)` : "";
  nodes.push(h("div", { class: "big" }, String(s.supported)), p(`job${s.supported === 1 ? "" : "s"} ready to apply${other}.`));
  if (!s.detailsComplete) nodes.push(p("Add your application details first (name, phone, location).", "warn"));

  // How each form is sent is the person's choice. Auto-send is explained before it can be switched on.
  const radio = (value, text) => {
    const input = h("input", { type: "radio", name: "m", value });
    input.checked = (s.mode === "auto") === (value === "auto");
    input.onchange = async () => {
      if (value === "auto" && !(await confirmAuto())) {
        input.checked = false;
        el.querySelector('input[value="review"]').checked = true;
        return;
      }
      await send({ type: "setMode", mode: value });
    };
    return h("label", {}, input, h("span", {}, text));
  };
  nodes.push(
    radio("review", "Let me check each form, I press Submit"),
    radio("auto", "Send each form for me when every required field is filled (5-second countdown, cancel any time)"),
  );
  const go = h("button", { id: "go", on: { onclick: async () => {
    const mode = el.querySelector('input[name="m"]:checked')?.value || "review";
    const r = await send({ type: "applyAll", mode });
    if (r?.ok) window.close();
    else render();
  } } }, `Apply to all ${s.supported || ""}`.trim());
  if (!s.supported) go.disabled = true;
  nodes.push(go);
  nodes.push(p("", "s"));
  nodes.at(-1).append(`Signed in as ${s.user}. `, h("a", { href: "#", on: { onclick: async (e) => (e.preventDefault(), await send({ type: "disconnect" }), render()) } }, "Disconnect"));
  show(...nodes);
}

// One plain explanation, agreed once per device, before auto-send can be on.
async function confirmAuto() {
  const { autoAck } = await chrome.storage.local.get(["autoAck"]);
  if (autoAck) return true;
  return new Promise((resolve) => {
    const box = h("div", { class: "ack" },
      p("With auto-send on, the extension presses Submit for you, 5 seconds after a form is filled. It only does this when every required field is filled and there is no “are you human?” check. You can cancel on each form, and you can switch it off here any time. Answers it isn't sure about are left blank, never guessed."),
      h("button", { on: { onclick: async () => { await chrome.storage.local.set({ autoAck: true }); box.remove(); resolve(true); } } }, "I understand, turn it on"),
      h("button", { class: "g", on: { onclick: () => { box.remove(); resolve(false); } } }, "Keep checking each form"),
    );
    el.prepend(box);
  });
}

render();
