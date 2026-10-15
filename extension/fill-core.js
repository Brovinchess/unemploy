// Career Ninja form filler. Finds the fields on a job application form, fills what it
// knows, and reports what still needs the person. No Chrome APIs here, so it can be
// tested by pasting into any page.
(() => {
  if (window.CareerNinjaFill) return;

  const norm = (s) => (s || "").toLowerCase().replace(/[\s ]+/g, " ").replace(/[*:?]/g, "").trim();

  // The visible question for a control: its label, aria text, or the text just before it.
  function labelFor(el) {
    const bits = [];
    if (el.getAttribute("aria-label")) bits.push(el.getAttribute("aria-label"));
    const by = el.getAttribute("aria-labelledby");
    if (by) by.split(/\s+/).forEach((id) => bits.push(document.getElementById(id)?.innerText || ""));
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l) bits.push(l.innerText);
    }
    const wrap = el.closest("label");
    if (wrap) bits.push(wrap.innerText);
    if (!bits.join("").trim()) {
      // Walk up to a container holding a label-ish element.
      let box = el.parentElement;
      for (let i = 0; i < 4 && box; i++, box = box.parentElement) {
        const t = box.querySelector("label, legend, .application-label, [class*='label'], [class*='question']");
        if (t && !t.contains(el) && t.innerText.trim()) {
          bits.push(t.innerText);
          break;
        }
      }
    }
    if (el.placeholder) bits.push(el.placeholder);
    bits.push(el.name || "", el.id || "");
    return norm(bits.join(" ")).slice(0, 300);
  }

  // The question as the person sees it (original wording), for saving answers.
  function questionText(el) {
    let t = el.getAttribute("aria-label") || "";
    const by = el.getAttribute("aria-labelledby");
    if (!t && by) t = by.split(/\s+/).map((id) => document.getElementById(id)?.innerText || "").join(" ");
    if (!t && el.id) t = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.innerText || "";
    if (!t) t = el.closest("label")?.innerText || "";
    if (!t) {
      let box = el.parentElement;
      for (let i = 0; i < 4 && box && !t; i++, box = box.parentElement) {
        const l = box.querySelector("label, legend, .application-label, [class*='label'], [class*='question']");
        if (l && !l.contains(el)) t = l.innerText || "";
      }
    }
    return t.replace(/[*✱]/g, "").replace(/\s+/g, " ").trim().slice(0, 300);
  }

  const SENSITIVE = /gender|\bsex\b|pronoun|race|ethnic|hispanic|latino|veteran|disab|sexual orientation|religio|marital|\bage\b|date of birth|birthday|social security|passport|national id|password/i;
  // Consent boxes are the person's to tick on each form; never learned as an answer.
  const CONSENT = /i (agree|accept|acknowledge|consent|certify|confirm)|terms (and|&) conditions|privacy (policy|notice)|data (protection|processing)|by (submitting|checking)/i;

  const visible = (el) => {
    if (el.type === "file") return !el.disabled; // Greenhouse and Ashby hide the real input behind a styled button
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return (r.width > 0 || r.height > 0) && st.visibility !== "hidden" && st.display !== "none";
  };

  // Only the field's own label counts for the "*": the nearest div on Greenhouse is the whole form.
  function isRequired(el, label) {
    if (el.required || el.getAttribute("aria-required") === "true") return true;
    const own = [el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`), el.closest("label")].filter(Boolean);
    return own.some((l) => /[*✱]/.test(l.innerText || "")) || /\brequired\b/.test(label);
  }

  // Demographic and identity questions are never filled, whatever we know.
  const isSensitive = (label) => SENSITIVE.test(label);

  // React and friends ignore plain .value writes; use the native setter and fire events.
  function setValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    el.focus();
    setter ? setter.call(el, value) : (el.value = value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.blur();
  }

  function attachFile(el, file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    el.files = dt.files;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fileFromBase64(name, mime, b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], name, { type: mime || "application/octet-stream" });
  }

  const words = (s) => new Set(norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  function similarity(a, b) {
    const A = words(a), B = words(b);
    if (!A.size || !B.size) return 0;
    let n = 0;
    A.forEach((w) => B.has(w) && n++);
    return n / Math.min(A.size, B.size);
  }

  // Pick the option of a <select> that best matches the wanted text.
  function chooseOption(select, want) {
    const w = norm(want);
    const opts = [...select.options].filter((o) => o.value && !/select|choose|--/i.test(o.text));
    const yes = /^(yes|y)\b/.test(w), no = /^(no|n)\b/.test(w);
    const hit =
      opts.find((o) => norm(o.text) === w) ||
      opts.find((o) => w && (norm(o.text).includes(w) || w.includes(norm(o.text)))) ||
      (yes && opts.find((o) => /^yes/i.test(o.text))) ||
      (no && opts.find((o) => /^no/i.test(o.text)));
    if (!hit) return false;
    setValue(select, hit.value);
    return true;
  }

  // Is this a plain yes/no choice (select options or a radio group)?
  function yesNoControl(el) {
    const texts =
      el.tagName === "SELECT"
        ? [...el.options].map((o) => o.text)
        : el.type === "radio"
          ? [...document.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`)].map((r) => r.closest("label")?.innerText || document.querySelector(`label[for="${CSS.escape(r.id)}"]`)?.innerText || r.value)
          : [];
    const t = texts.map((x) => norm(x)).filter((x) => x && !/select|choose|--/.test(x));
    return t.length >= 2 && t.length <= 4 && t.some((x) => /^yes\b/.test(x)) && t.some((x) => /^no\b/.test(x));
  }

  // What to put in a field, from its label.
  function answerFor(label, el, d, job) {
    const a = d.applicant || {};
    const has = (re) => re.test(label);
    if (el.type === "file") {
      if (has(/resume|cv\b|curriculum/)) return { file: "resume" };
      if (has(/cover/)) return { file: "cover" };
      return null;
    }
    // Saved answers from earlier forms (used when the details don't cover the question).
    let saved = null, savedScore = 0;
    for (const qa of d.savedAnswers || []) {
      const s = similarity(label, qa.question);
      if (s > savedScore) (savedScore = s), (saved = qa.answer);
    }
    // The person's own saved answers are authoritative: same bar as the headhunter's answers below.
    const fromSaved = savedScore >= 0.5 ? saved : null;
    const pick = (v) => (v && String(v).trim() ? v : fromSaved);

    if (has(/first ?name|given name|fname|first_name/)) return a.firstName;
    if (has(/last ?name|surname|family name|lname|last_name/)) return a.lastName;
    if (has(/preferred name/)) return a.firstName;
    if (has(/\bname\b/) && !has(/company|employer|school|university|reference|manager|recruiter|hear/)) return [a.firstName, a.lastName].filter(Boolean).join(" ");
    if (has(/e-?mail/)) return a.email;
    if (has(/phone|mobile|telephone|\btel\b/)) return a.phone;
    if (has(/linkedin/)) return pick(a.linkedin);
    if (has(/twitter|\bx\.com|instagram|facebook|dribbble|behance/)) return null;
    if (has(/github/)) return a.website && /github\.com/i.test(a.website) ? a.website : null;
    if (has(/portfolio|website|personal (site|url)|other (url|website)|\burl\b/)) return a.website || null;
    if (has(/\bcountry\b/) && !has(/countries/)) {
      const last = (a.location || "").split(",").pop().trim();
      const short = { us: "United States", usa: "United States", uk: "United Kingdom", my: "Malaysia", sg: "Singapore", hk: "Hong Kong", au: "Australia", ca: "Canada", nl: "Netherlands", de: "Germany", in: "India", id: "Indonesia", ph: "Philippines", th: "Thailand", vn: "Vietnam" };
      return short[last.toLowerCase()] || (last.length > 3 ? last : null);
    }
    if (has(/location|city|where are you (based|located)|current address|country of residence/)) return pick(a.location);
    if (has(/cover letter/)) return job.coverLetter;
    if (has(/sponsor/)) return pick(a.workAuthorization && /no sponsorship|not need|don.?t need|without sponsorship/i.test(a.workAuthorization) ? "No" : a.workAuthorization);
    if (has(/authori[sz]ed|right to work|eligible to work|work permit|visa/)) {
      // A yes/no control wants "Yes", not the sentence from the details.
      const wa = a.workAuthorization || "";
      const positive = /citizen|permanent resident|authori[sz]ed|no sponsorship|right to work|eligible|allowed to work/i.test(wa) && !/not (authori|eligible|allowed)|need(s|ed)? (a )?(visa|sponsorship)|requires? sponsorship/i.test(wa);
      if (wa && yesNoControl(el)) return positive ? "Yes" : pick(null);
      return pick(wa);
    }
    if (has(/notice period|start date|when can you start|available to start|availability/)) return pick(a.noticePeriod);
    if (has(/current (company|employer)|(company|employer) name|employer|most recent company|where do you (currently )?work/) && !has(/previous|former|reference/)) return pick(a.currentCompany);
    if (has(/current (job )?title|current (role|position)|job title|most recent (title|role)/) && !has(/desired|target|applying/)) return pick(a.currentTitle);
    if (has(/salary|compensation|pay expectation|expected pay|desired pay/)) return pick(a.salaryExpectation);
    // The headhunter's prepared answers, matched by question.
    if (fromSaved) return fromSaved;
    let best = null, score = 0;
    for (const qa of job.answers || []) {
      const s = similarity(label, qa.question);
      if (s > score) (score = s), (best = qa.answer);
    }
    if (score >= 0.5) return best;
    if (el.tagName === "TEXTAREA" && has(/additional information|anything else|tell us about yourself|about you|why .*(us|company|role|join)|motivation|comments/)) {
      return has(/why/) ? job.coverLetter : job.aboutMe || job.coverLetter;
    }
    return null;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const isCombo = (el) =>
    el.getAttribute("role") === "combobox" || el.getAttribute("aria-autocomplete") === "list" || !!el.closest('[class*="select__control"], [class*="Select-control"]');

  // Type into a pick-from-list box, then click the suggestion that matches.
  async function chooseFromList(el, value) {
    setValue(el, value);
    el.focus();
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    for (let i = 0; i < 12; i++) {
      await sleep(150);
      const opts = [...document.querySelectorAll('[role="option"], [class*="select__option"], [class*="Select-option"]')].filter(visible);
      if (!opts.length) continue;
      const v = norm(value);
      const yes = /^(yes|y)\b/.test(v), no = /^(no|n)\b/.test(v);
      const hit =
        opts.find((o) => norm(o.innerText) === v) ||
        opts.find((o) => norm(o.innerText).startsWith(v) || v.startsWith(norm(o.innerText))) ||
        opts.find((o) => norm(o.innerText).includes(v)) ||
        (yes && opts.find((o) => /^yes/i.test(o.innerText.trim()))) ||
        (no && opts.find((o) => /^no/i.test(o.innerText.trim())));
      if (hit) {
        hit.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        hit.click();
        await sleep(100);
        return true;
      }
    }
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return false;
  }

  function captchaPresent() {
    return !!document.querySelector('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[title*="challenge" i], .g-recaptcha, .h-captcha, [data-sitekey]');
  }

  function submitButton() {
    const buttons = [...document.querySelectorAll('button, input[type="submit"]')].filter(visible);
    return (
      buttons.find((b) => /submit (my )?application|send application|apply now|submit$/i.test((b.innerText || b.value || "").trim())) ||
      buttons.find((b) => b.type === "submit")
    );
  }

  // A confirmation page says thanks AND no longer shows the form. Job descriptions say
  // "thank you for your interest" too, so the words alone never count.
  const SUCCESS = /thank you for (applying|your application|submitting)|application (has been )?(submitted|received)|we('ve| have) received your application|application complete|successfully submitted/i;
  const formGone = () => [...document.querySelectorAll("input, textarea, select")].filter((el) => !["hidden", "submit", "button"].includes(el.type) && visible(el)).length < 3;
  const submitted = () => SUCCESS.test(document.body?.innerText?.slice(0, 20000) || "") && formGone() && !submitButton();

  // Fill the form. data = { applicant, job, resume: {fileName, mime, data} }.
  // With dryRun, nothing is typed: it only reports what it would do (for testing).
  async function fill(data, { dryRun = false } = {}) {
    const { job } = data;
    const controls = [...document.querySelectorAll("input, textarea, select")].filter(
      (el) => !["hidden", "submit", "button", "checkbox", "radio", "password", "search", "image", "reset"].includes(el.type) && !el.disabled && visible(el),
    );
    const filled = [], missing = [], seen = new Set();
    runInfo = [];
    for (const el of controls) {
      const label = labelFor(el);
      if (!label || seen.has(el)) continue;
      seen.add(el);
      if (isSensitive(label)) continue;
      const required = isRequired(el, label);
      if (el.type === "file" ? el.files?.length : el.value && el.value.trim()) continue; // never overwrite what's there
      const ans = answerFor(label, el, data, job);
      let ok = false;
      if (dryRun) {
        const would = ans && typeof ans === "object" ? `[${ans.file} file]` : typeof ans === "string" && ans.trim() ? ans.slice(0, 40) : null;
        if (would) filled.push(`${label.slice(0, 50)} ← ${would}`);
        else if (required) missing.push(label.slice(0, 60));
        continue;
      }
      if (ans && typeof ans === "object" && ans.file) {
        if (ans.file === "resume" && data.resume?.data) {
          attachFile(el, fileFromBase64(data.resume.fileName || "resume.pdf", data.resume.mime, data.resume.data));
          ok = true;
        } else if (ans.file === "cover" && job.coverLetter) {
          attachFile(el, new File([job.coverLetter], `Cover letter - ${job.company}.txt`, { type: "text/plain" }));
          ok = true;
        }
      } else if (typeof ans === "string" && ans.trim()) {
        ok = el.tagName === "SELECT" ? chooseOption(el, ans) : isCombo(el) ? await chooseFromList(el, ans) : (setValue(el, ans), true);
      }
      const name = label.slice(0, 60);
      // Remember what we put there: if the person changes it before submitting, that's the answer to keep.
      runInfo.push({ el, auto: ok, was: ok && typeof ans === "string" ? ans.trim() : null });
      if (ok) {
        filled.push(name);
        el.style.outline = "";
      } else if (required) {
        missing.push(name);
        el.style.outline = "2px solid #c96567";
        el.style.outlineOffset = "2px";
      }
    }
    // Yes/no radio groups (right to work, relocation): pick the option that matches what we know.
    // Consent boxes and anything demographic stay the person's call.
    if (!dryRun) {
      const groups = new Map();
      document.querySelectorAll('input[type="radio"]').forEach((r) => {
        if (!r.name || !visible(r) || r.disabled) return;
        if (!groups.has(r.name)) groups.set(r.name, []);
        groups.get(r.name).push(r);
      });
      for (const radios of groups.values()) {
        if (radios.some((r) => r.checked) || radios.some((r) => seen.has(r))) continue;
        radios.forEach((r) => seen.add(r));
        const question = groupLabel(radios[0]);
        if (!question || isSensitive(question)) continue;
        const ans = answerFor(question, radios[0], data, job);
        if (typeof ans !== "string" || !ans.trim()) continue;
        const want = norm(ans), yes = /^(yes|y)\b/.test(want), no = /^(no|n)\b/.test(want);
        const text = (r) => norm(r.closest("label")?.innerText || document.querySelector(`label[for="${CSS.escape(r.id)}"]`)?.innerText || r.value);
        const hit =
          radios.find((r) => text(r) === want) ||
          radios.find((r) => want && (text(r).includes(want) || want.includes(text(r)))) ||
          (yes && radios.find((r) => /^yes/.test(text(r)))) ||
          (no && radios.find((r) => /^no/.test(text(r))));
        if (hit) {
          hit.click();
          hit.dispatchEvent(new Event("change", { bubbles: true }));
          filled.push(question.slice(0, 60));
          runInfo.push({ el: hit, auto: true, was: text(hit) });
        }
      }
    }
    document.querySelectorAll('input[type="checkbox"][required], input[type="radio"][required]').forEach((el) => {
      if (visible(el) && !el.checked && ![...el.form?.elements || []].some((o) => o.name === el.name && o.checked)) missing.push(labelFor(el).slice(0, 60) || "a required checkbox");
    });
    return { filled, missing: [...new Set(missing)], captcha: captchaPresent(), canSubmit: !!submitButton() };
  }

  // The question a radio group answers: its fieldset legend or the label above the group.
  function groupLabel(radio) {
    const fs = radio.closest("fieldset");
    const legend = fs?.querySelector("legend");
    if (legend?.innerText?.trim()) return norm(legend.innerText).slice(0, 300);
    const by = radio.closest("[role='radiogroup']")?.getAttribute("aria-labelledby");
    if (by) return norm(document.getElementById(by)?.innerText || "").slice(0, 300);
    let box = radio.parentElement;
    for (let i = 0; i < 5 && box; i++, box = box.parentElement) {
      const t = box.querySelector("legend, .application-label, [class*='label'], [class*='question']");
      if (t && !t.contains(radio) && t.innerText.trim()) return norm(t.innerText).slice(0, 300);
    }
    return "";
  }

  // Fields the extension left for the person and what they typed there, plus prefilled fields
  // they corrected before submitting. Both become saved answers.
  let runInfo = [];
  function currentValue(el) {
    if (el.type === "radio") {
      const on = [...document.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`)].find((r) => r.checked);
      return on ? (on.closest("label")?.innerText || document.querySelector(`label[for="${CSS.escape(on.id)}"]`)?.innerText || on.value || "").trim() : "";
    }
    if (el.tagName === "SELECT") return el.selectedOptions[0]?.text?.trim() || "";
    if (isCombo(el)) {
      const box = el.closest('[class*="select__control"], [class*="Select-control"], [role="combobox"]')?.parentElement;
      const shown = box?.querySelector('[class*="single-value"], [class*="singleValue"], [class*="Select-value-label"]');
      return (shown?.innerText || el.value || "").trim();
    }
    return (el.value || "").trim();
  }
  function learned() {
    const out = [];
    for (const { el, auto, was } of runInfo) {
      if (el.type === "file" || !el.isConnected) continue;
      const question = el.type === "radio" ? groupLabel(el) : questionText(el);
      const answer = currentValue(el);
      if (!question || question.length < 3 || !answer || SENSITIVE.test(question) || CONSENT.test(question)) continue;
      // Prefilled and left alone: nothing new to learn. Prefilled and changed: learn the correction.
      if (auto && (was == null || answer === was)) continue;
      if (el.tagName === "TEXTAREA" && answer.length > 400) continue; // job-specific essays
      out.push({ question, answer });
    }
    return out;
  }

  window.CareerNinjaFill = { fill, submitButton, submitted, captchaPresent, labelFor, learned, isSensitive };
})();
