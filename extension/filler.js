// Runs on job application pages. During "Apply to all" it fills the form, shows what
// still needs the person, and reports back when the company confirms the application.
(async () => {
  const send = (msg) => chrome.runtime.sendMessage(msg).catch(() => null);
  const ctx = await send({ type: "whatToFill" });
  if (!ctx?.job) return;
  const F = window.CareerNinjaFill;

  // Back on this tab after the person pressed Submit (a full-page redirect to "thanks").
  if (ctx.submitClicked && F.submitted()) return finish("Application sent.");

  const ui = panel(ctx);
  ui.say("Filling in your application…");

  // Forms built with JavaScript appear a moment after the page loads.
  for (let i = 0; i < 40 && document.querySelectorAll("input, textarea").length < 3; i++) await new Promise((r) => setTimeout(r, 250));
  await new Promise((r) => setTimeout(r, 600));

  const data = { applicant: ctx.applicant, job: ctx.job, resume: ctx.resume, savedAnswers: ctx.savedAnswers };
  let result = await F.fill(data);
  let submitClicked = false, done = false;
  watchForConfirmation();
  captureSubmit();
  refillLateFields();

  const needs = () => {
    const n = [...result.missing];
    if (result.captcha) n.unshift("the “are you human?” check");
    if (!result.canSubmit) n.push("find the Submit button");
    return n;
  };

  // Auto-send is the person's choice, switched on in the popup. It only runs when every
  // required field is filled and there is no captcha, and it can be cancelled on each form.
  if (ctx.mode === "auto" && !needs().length) {
    let n = 5;
    const tick = () => ui.say(`Filled ${result.filled.length} fields. Sending in ${n}s…`, [{ label: "Cancel, let me check", act: () => (n = -1) }]);
    tick();
    const t = setInterval(() => {
      if (n < 0) {
        clearInterval(t);
        return review();
      }
      if (--n === 0) {
        clearInterval(t);
        ui.say("Sending…");
        markClicked();
        F.submitButton()?.click();
      } else tick();
    }, 1000);
  } else review();

  function review() {
    const n = needs();
    ui.say(
      n.length
        ? `Filled ${result.filled.length} fields. Please check the form and complete: ${n.slice(0, 4).join(", ")}${n.length > 4 ? "…" : ""}. Then press Submit.`
        : `Filled ${result.filled.length} fields. Check everything, then press the form's Submit button.`,
      [
        { label: "I've submitted", act: () => finish() },
        { label: "Skip this job", act: () => !done && ((done = true), send({ type: "skip" })) },
      ],
    );
  }

  // Fields the form adds later ("enter manually" cover letter, conditional questions) get one more pass.
  function refillLateFields() {
    let timer;
    const obs = new MutationObserver(() => {
      if (done || submitClicked) return obs.disconnect();
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const again = await F.fill(data);
        if (!again.filled.length) return;
        result = {
          filled: [...new Set([...result.filled, ...again.filled])],
          missing: again.missing,
          captcha: again.captcha,
          canSubmit: again.canSubmit,
        };
        if (ctx.mode !== "auto") review();
      }, 800);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  // Remember what the person typed into fields the extension couldn't fill.
  let learnt = 0;
  async function learn() {
    if (learnt) return learnt;
    const answers = F.learned();
    learnt = answers.length || -1;
    if (answers.length) await send({ type: "learn", answers });
    return answers.length;
  }
  function markClicked() {
    if (submitClicked) return;
    submitClicked = true;
    send({ type: "submitClicked" });
    learn();
  }
  function captureSubmit() {
    document.addEventListener("submit", markClicked, true);
    document.addEventListener(
      "click",
      (e) => {
        const btn = F.submitButton();
        if (btn && (e.target === btn || btn.contains(e.target))) markClicked();
      },
      true,
    );
  }

  // Single-page forms swap in a confirmation without reloading. Only counts after Submit was pressed.
  function watchForConfirmation() {
    const obs = new MutationObserver(() => {
      if (done) return obs.disconnect();
      if (submitClicked && F.submitted()) {
        obs.disconnect();
        finish("Application sent.");
      }
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  // One exit per tab: tells the person what was kept, then hands over to the next job.
  async function finish(lead = "") {
    if (done) return;
    done = true;
    const n = await learn();
    const kept = n > 0 ? ` Saved ${n} ${n === 1 ? "answer" : "answers"} for next time.` : "";
    try {
      ui.say(`${lead || "Marked as applied."}${kept} Moving on…`);
    } catch {}
    send({ type: "submitted" });
  }

  function panel(c) {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483647";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>
      .p{width:320px;font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:#f3f5f7;background:#18212a;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:16px 16px 14px;box-shadow:0 30px 60px -20px rgba(0,0,0,.6)}
      .h{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-weight:600}
      .h b{color:#c96567} .h span{font-weight:400;color:rgba(255,255,255,.5);font-size:12px}
      .m{color:rgba(255,255,255,.8)} .a{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
      button{border:0;border-radius:999px;padding:8px 14px;font:600 13px system-ui;cursor:pointer;background:rgba(255,255,255,.08);color:#fff}
      button:first-child{background:#c96567}
    </style><div class="p"><div class="h"><div>careerninja<b>.</b></div><span></span></div><div class="m"></div><div class="a"></div></div>`;
    root.querySelector(".h span").textContent = `Job ${c.position} of ${c.total}`;
    document.documentElement.appendChild(host);
    const m = root.querySelector(".m"), a = root.querySelector(".a");
    return {
      say(text, actions = []) {
        m.textContent = text;
        a.replaceChildren(
          ...actions.map((x) => {
            const b = document.createElement("button");
            b.textContent = x.label;
            b.onclick = x.act;
            return b;
          }),
        );
      },
    };
  }
})();
