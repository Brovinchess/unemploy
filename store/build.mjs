// Builds the Chrome Web Store package: the extension without the localhost permission
// used for local testing. Output: store/career-ninja-extension-<version>.zip
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const out = "store/.build";
rmSync(out, { recursive: true, force: true });
cpSync("extension", out, { recursive: true });
const manifest = JSON.parse(readFileSync(`${out}/manifest.json`, "utf8"));
const notLocal = (m) => !m.includes("localhost");
manifest.host_permissions = manifest.host_permissions.filter(notLocal);
manifest.content_scripts.forEach((cs) => (cs.matches = cs.matches.filter(notLocal)));
writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest, null, 2));
const popup = readFileSync(`${out}/popup.js`, "utf8").replace(/\n\s*<p class="s">Testing locally\?.*?<\/p>/, "");
writeFileSync(`${out}/popup.js`, popup);
const zip = `store/career-ninja-extension-${manifest.version}.zip`;
rmSync(zip, { force: true });
execSync(`cd ${out} && zip -qr ../${zip.split("/").pop()} . -x '*.DS_Store'`);
rmSync(out, { recursive: true, force: true });
console.log(zip);
