// Renders the store images from HTML with headless Chrome: node store/assets/make.mjs
import { writeFileSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const mochi = readFileSync("src/app/icon.svg", "utf8");
const base = `<meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui;color:#f3f5f7;background:radial-gradient(80% 70% at 30% 20%,#223140 0%,#141b22 60%);overflow:hidden}
.j{font-family:'Plus Jakarta Sans',Inter}.c{color:#c96567}.m{color:rgba(255,255,255,.6)}
.win{background:#fff;border-radius:16px;box-shadow:0 40px 80px -20px rgba(0,0,0,.7);overflow:hidden;color:#1f2933}
.bar{height:36px;background:#eef1f4;display:flex;align-items:center;gap:6px;padding:0 14px}.bar i{width:10px;height:10px;border-radius:50%;background:#d5dbe1}
.url{margin-left:14px;flex:1;height:22px;border-radius:6px;background:#fff;font-size:12px;color:#6b7785;display:flex;align-items:center;padding:0 10px}
.f{padding:22px 28px}.f h3{margin:0 0 4px;font:600 20px 'Plus Jakarta Sans'}.f p{margin:0 0 16px;color:#6b7785;font-size:13px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.fld{margin-bottom:12px}.fld label{display:block;font-size:12px;color:#52606d;margin-bottom:4px}
.fld div{height:36px;border:1px solid #d5dbe1;border-radius:8px;padding:0 10px;display:flex;align-items:center;font-size:13px;background:#fff}
.fld div.ok{border-color:#9fd3b0;background:#f3fbf6}.fld div.need{border:2px solid #c96567;background:#fff7f7}
.fld .ta{height:70px;align-items:flex-start;padding-top:8px;line-height:1.4}
.panel{position:absolute;width:300px;background:#18212a;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:16px;color:#f3f5f7;font-size:13px;line-height:1.45;box-shadow:0 30px 60px -20px rgba(0,0,0,.6)}
.panel .h{display:flex;justify-content:space-between;font-weight:600;margin-bottom:8px}.panel .h span{color:rgba(255,255,255,.5);font-weight:400;font-size:12px}
.btns{display:flex;gap:8px;margin-top:12px}.btns b{border-radius:999px;padding:7px 12px;font-size:12px;background:rgba(255,255,255,.08)}.btns b:first-child{background:#c96567}
.mochi svg{width:100%;height:100%}
</style>`;

const pages = {
  "screenshot-1": [1280, 800, `<div style="display:flex;height:800px;align-items:center;padding:0 70px;gap:60px">
    <div style="width:430px"><div class="mochi" style="width:76px;height:72px">${mochi}</div>
      <h1 class="j" style="font-size:46px;line-height:1.08;margin:22px 0 14px;font-weight:600">Fill every job application <span class="c">in one click</span></h1>
      <p class="m" style="font-size:18px;line-height:1.5;margin:0">Career Ninja types in your details, resume, cover letter and answers. You check, then press Submit.</p></div>
    <div style="position:relative;flex:1"><div class="win"><div class="bar"><i></i><i></i><i></i><div class="url">job-boards.greenhouse.io/acme/jobs/4821</div></div>
      <div class="f"><h3>Senior Product Manager</h3><p>Acme · Remote</p>
      <div class="row"><div class="fld"><label>First name *</label><div class="ok">Alex</div></div><div class="fld"><label>Last name *</label><div class="ok">Tan</div></div></div>
      <div class="row"><div class="fld"><label>Email *</label><div class="ok">alex@example.com</div></div><div class="fld"><label>Phone *</label><div class="ok">+60 12-345 6789</div></div></div>
      <div class="fld"><label>Resume *</label><div class="ok">📎 Alex_Tan_Resume.pdf</div></div>
      <div class="fld"><label>Why do you want to work at Acme? *</label><div class="ok ta">I led the redesign of a payments app used by 1.2M people, and Acme's roadmap…</div></div>
      <div class="fld"><label>Expected salary *</label><div class="need"></div></div></div></div>
      <div class="panel" style="right:-30px;bottom:-30px"><div class="h"><div>careerninja<span class="c">.</span></div><span>Job 2 of 5</span></div>
      Filled 11 fields. Please complete: Expected salary. Then press Submit.<div class="btns"><b>I've submitted</b><b>Skip this job</b></div></div></div></div>`],
  "screenshot-2": [1280, 800, `<div style="display:flex;height:800px;align-items:center;padding:0 90px;gap:80px">
    <div style="width:460px"><h1 class="j" style="font-size:46px;line-height:1.08;margin:0 0 14px;font-weight:600">Swipe right.<br><span class="c">Apply to all.</span></h1>
      <p class="m" style="font-size:18px;line-height:1.5;margin:0 0 22px">Pick the jobs your AI headhunter found, then let the extension open each application, fill it in and move to the next.</p>
      <p class="m" style="font-size:15px;margin:0">✓ Review every form, or send automatically when it's complete<br>✓ Marks each job “Applied” when the company confirms<br>✓ Works on Greenhouse, Lever and Ashby</p></div>
    <div style="width:330px;background:#141b22;border-radius:18px;border:1px solid rgba(255,255,255,.08);padding:20px;box-shadow:0 40px 80px -20px rgba(0,0,0,.7)">
      <div style="display:flex;align-items:center;gap:10px;font-weight:600;font-size:16px"><div class="mochi" style="width:30px;height:28px">${mochi}</div>careerninja<span class="c">.</span></div>
      <div class="j" style="font-size:34px;font-weight:600;margin:16px 0 2px">5</div><p class="m" style="margin:0 0 14px">jobs ready to apply.</p>
      <p style="font-size:13px;color:rgba(255,255,255,.8);margin:8px 0">◉ Let me check each form before it's sent</p><p style="font-size:13px;color:rgba(255,255,255,.55);margin:8px 0">○ Send automatically when every required field is filled</p>
      <div style="margin-top:16px;border-radius:999px;background:#c96567;text-align:center;padding:12px;font-weight:600">Apply to all 5</div></div></div>`],
  "screenshot-3": [1280, 800, `<div style="height:800px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 120px">
    <div class="mochi" style="width:90px;height:86px">${mochi}</div>
    <h1 class="j" style="font-size:46px;margin:22px 0 12px;font-weight:600">Your AI headhunter, <span class="c">now in your browser</span></h1>
    <p class="m" style="font-size:19px;max-width:760px;line-height:1.5;margin:0">Career Ninja finds jobs that fit, checks they're open and that you can apply, and writes each application from your real resume. The extension handles the forms.</p>
    <div style="display:flex;gap:16px;margin-top:40px">${["Finds jobs you'd win", "Writes every application", "Fills the forms", "You press Submit"].map((t, i) => `<div style="width:220px;padding:20px;border-radius:20px;background:#1b2530;border:1px solid rgba(255,255,255,.07)"><div class="j c" style="font-size:14px;font-weight:600">0${i + 1}</div><div class="j" style="font-size:18px;margin-top:6px">${t}</div></div>`).join("")}</div></div>`],
  "promo-tile": [440, 280, `<div style="height:280px;display:flex;align-items:center;gap:22px;padding:0 34px"><div class="mochi" style="width:110px;height:104px;flex-shrink:0">${mochi}</div>
    <div><div class="j" style="font-size:15px;font-weight:600;color:rgba(255,255,255,.7)">careerninja<span class="c">.</span></div><div class="j" style="font-size:30px;line-height:1.1;font-weight:600;margin-top:8px">Apply to all,<br><span class="c">in one go</span></div></div></div>`],
};

for (const [name, [w, h, body]] of Object.entries(pages)) {
  const file = `store/assets/${name}.html`;
  writeFileSync(file, `<!doctype html><html><head>${base}</head><body style="width:${w}px;height:${h}px">${body}</body></html>`);
  execSync(`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=4000 --window-size=${w},${h} --screenshot=store/assets/${name}.png "file://${process.cwd()}/${file}"`, { stdio: "ignore" });
  console.log(`store/assets/${name}.png`);
}
