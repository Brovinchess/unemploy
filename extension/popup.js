const el = document.getElementById("body");
const send = (m) => chrome.runtime.sendMessage(m);

async function render() {
  const s = await send({ type: "status" });
  if (!s.connected) {
    el.innerHTML = `<p>Connect the extension to your Career Ninja account to fill applications for you.</p>
      <a class="btn" href="https://careerninja.app/app/extension" target="_blank">Connect</a>
      <p class="s">Testing locally? Open localhost:3000/app/extension instead.</p>`;
    return;
  }
  if (s.running) {
    el.innerHTML = `<div class="big">${s.run.index + 1} / ${s.run.ids.length}</div><p>Applying now. Check each form, then press its Submit button.</p>
      <button class="g" id="stop">Stop</button>`;
    document.getElementById("stop").onclick = async () => (await send({ type: "stop" }), render());
    return;
  }
  el.innerHTML = `<div class="big">${s.supported}</div><p>job${s.supported === 1 ? "" : "s"} ready to apply${s.waiting > s.supported ? ` (${s.waiting - s.supported} on other sites, apply from the app)` : ""}.</p>
    ${s.detailsComplete ? "" : `<p style="color:#e08a8c">Add your application details first (name, phone, location).</p>`}
    <label><input type="radio" name="m" value="review" ${s.mode !== "auto" ? "checked" : ""}> <span>Let me check each form before it's sent</span></label>
    <label><input type="radio" name="m" value="auto" ${s.mode === "auto" ? "checked" : ""}> <span>Send automatically when every required field is filled</span></label>
    <button id="go" ${s.supported ? "" : "disabled"}>Apply to all ${s.supported || ""}</button>
    <p class="s">Signed in as ${s.user}. <a href="#" id="out" style="color:inherit">Disconnect</a></p>`;
  el.querySelectorAll('input[name="m"]').forEach((r) => (r.onchange = () => send({ type: "setMode", mode: r.value })));
  document.getElementById("go").onclick = async () => {
    const mode = el.querySelector('input[name="m"]:checked').value;
    const r = await send({ type: "applyAll", mode });
    if (r?.ok) window.close();
    else render();
  };
  document.getElementById("out").onclick = async (e) => (e.preventDefault(), await send({ type: "disconnect" }), render());
}
render();
