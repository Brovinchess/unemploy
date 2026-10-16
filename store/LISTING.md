# Chrome Web Store listing notes

Everything the dashboard asks for, ready to paste. Keep this in step with `extension/manifest.json`.

## Package

- Upload the zip from `npm run ext:store` → `store/career-ninja-extension-<version>.zip` (manifest at the root of the zip).
- Screenshots and promo tile: `node store/assets/make.mjs` → `store/assets/` (regenerate after UI changes).
- Local testing: `npm run ext:dev` builds `extension-dev/` with localhost added; load that unpacked. The shipped manifest never carries a dev host.
- Version 1.0.0. Bump the manifest and rebuild before every upload.

## Store listing

**Name:** Career Ninja

**Summary (132 chars max):**
Fills job application forms with the answers your Career Ninja headhunter prepared. You check each one and press Submit.

**Description:**
Career Ninja is your own AI headhunter: it finds open jobs that fit you and writes each application from your resume. This extension does the last step. When you say yes to a job in Career Ninja, the extension opens its application form and fills in your details, resume, cover letter and the answers your headhunter prepared.

What it does
- Fills forms on Greenhouse, Lever and Ashby job boards, one job at a time.
- Highlights anything it could not fill, so you can finish it in seconds.
- Remembers answers you type, so the next form asks you less.
- Never fills or stores questions about gender, ethnicity, disability or veteran status.
- Leaves Submit to you. If you prefer, switch on auto-send: it then sends a form only when every required field is filled and there is no human check, after a 5-second countdown you can cancel. Off by default.

What it needs
- A Career Ninja account (free to start) connected from careerninja.app, Settings.
- Nothing else. It does not read other websites or your browsing history.

**Category:** Productivity. **Language:** English.

## Privacy practices (dashboard tab)

Single purpose: fill job application forms with the user's own Career Ninja application data, on the job boards it supports.

Permission justifications
- `storage`: keeps the sign-in token for the user's Career Ninja account and the user's settings (review or auto-send) in the browser.
- Host `careerninja.app`: lets the Career Ninja website hand the extension its sign-in token and start "Apply to all"; all data the extension uses comes from this host.
- Hosts `boards.greenhouse.io`, `job-boards.greenhouse.io`, `jobs.lever.co`, `jobs.eu.lever.co`, `jobs.ashbyhq.com`: the job application pages it fills. `all_frames` because Greenhouse forms are embedded in iframes on company career pages.
- No remote code. No `tabs`, `scripting`, `webRequest` or `<all_urls>`.

Data collected (tick in the dashboard)
- Personally identifiable information: name, email, phone, location, LinkedIn or website, current employer and title, right to work, notice period, salary expectation. Used only to fill the form the user chose to apply to.
- Authentication information: the Career Ninja sign-in token, stored locally.
- User activity / website content: the extension reads the fields of the application form it is filling, and the answers the user types into fields it could not fill. Those answers are saved to the user's Career Ninja account for reuse. Nothing from other pages.
- Not collected: health, financial, location tracking, browsing history, personal communications.

Certifications: data is not sold, not used for purposes unrelated to the single purpose, not used for creditworthiness or lending.

Privacy policy URL: https://careerninja.app/privacy (section "The Chrome extension").

## Assets to prepare

- Screenshots, 1280×800 or 640×400, at least one: the popup over a Greenhouse form being filled, the panel saying what still needs the person, the Career Ninja jobs board with "Apply to all".
- Small promo tile 440×280 (Mochi + wordmark on navy, from `brand-kit/`).
- Icon 128×128: `extension/icons/128.png`.

## Live

Published 16 Oct 2026: https://chromewebstore.google.com/detail/career-ninja/pegmolmikinefghoeollhdaaedbddkaa

## Go-live checklist (done 16 Oct 2026; kept for the record)

1. In Vercel production set `NEXT_PUBLIC_EXTENSION_LIVE=1` and `NEXT_PUBLIC_EXTENSION_STORE_URL=<listing url>`, then redeploy (build-time variables).
2. Landing page: remove the three "coming soon" lines in `src/app/page.tsx` (feature card, FAQ, extension section pill and future tense).
3. Remove `public/career-ninja-extension.zip` and the `ext:zip` script; Settings then shows "Add to Chrome".
4. Raise `MIN_EXTENSION_VERSION` in `src/lib/extension.ts` only when an app change needs a newer build; older installs then see an update nudge.
