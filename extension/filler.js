// Runs on job application pages. During "Apply to all" it fills the form, shows what
// still needs the person, and reports back when the company confirms the application.
(async () => {
  const send = (msg) => chrome.runtime.sendMessage(msg).catch(() => null);
  const ctx = await send({ type: "whatToFill" });
  if (!ctx?.job) return;

  // Already on the company's "thanks, we got it" page (e.g. after a redirect).
  if (window.CareerNinjaFill.submitted()) return send({ type: "submitted" });

  const ui = panel(ctx);
  ui.say("Filling in your application…");

  // Forms built with JavaScript appear a moment after the page loads.
  for (let i = 0; i < 40 && document.querySelectorAll("input, textarea").length < 3; i++) await new Promise((r) => setTimeout(r, 250));
  await new Promise((r) => setTimeout(r, 600));

  const result = await window.CareerNinjaFill.fill({
    applicant: ctx.applicant,
    job: ctx.job,
    resume: ctx.resume,
    savedAnswers: ctx.savedAnswers,
  });
  watchForConfirmation();
  captureAnswersOnSubmit();

  const needs = [...result.missing];
  if (result.captcha) needs.unshift("the “are you human?” check");
  if (!result.canSubmit) needs.push("find the Submit button");

  if (ctx.mode === "auto" && !needs.length) {
    let n = 5;
    ui.say(`Filled ${result.filled.length} fields. Submitting in ${n}s…`, [{ label: "Cancel", act: () => (n = -1) }]);
    const t = setInterval(() => {
      if (n < 0) {
        clearInterval(t);
        return review();
      }
      if (--n === 0) {
        clearInterval(t);
        ui.say("Submitting…");
        window.CareerNinjaFill.submitButton()?.click();
      } else ui.say(`Filled ${result.filled.length} fields. Submitting in ${n}s…`, [{ label: "Cancel", act: () => (n = -1) }]);
    }, 1000);
  } else review();

  function review() {
    ui.say(
      needs.length
        ? `Filled ${result.filled.length} fields. Please check the form and complete: ${needs.slice(0, 4).join(", ")}${needs.length > 4 ? "…" : ""}. Then press Submit.`
        : `Filled ${result.filled.length} fields. Check everything, then press the form's Submit button.`,
      [
        { label: "I've submitted", act: () => (learn(), send({ type: "submitted" })) },
        { label: "Skip this job", act: () => send({ type: "skip" }) },
      ],
    );
  }

  // Remember what the person typed into fields the extension couldn't fill.
  let learnt = false;
  function learn() {
    if (learnt) return;
    learnt = true;
    const answers = window.CareerNinjaFill.learned();
    if (answers.length) send({ type: "learn", answers });
  }
  function captureAnswersOnSubmit() {
    document.addEventListener("submit", learn, true);
    document.addEventListener(
      "click",
      (e) => {
        const btn = window.CareerNinjaFill.submitButton();
        if (btn && (e.target === btn || btn.contains(e.target))) learn();
      },
      true,
    );
  }

  // Single-page forms swap in a confirmation without reloading.
  function watchForConfirmation() {
    const check = () => {
      if (window.CareerNinjaFill.submitted()) {
        obs.disconnect();
        ui.say("Application sent! Marking it as applied and moving on…");
        send({ type: "submitted" });
      }
    };
    const obs = new MutationObserver(() => check());
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
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
    </style><div class="p"><div class="h"><div>careerninja<b>.</b></div><span>Job ${c.position} of ${c.total}</span></div><div class="m"></div><div class="a"></div></div>`;
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
