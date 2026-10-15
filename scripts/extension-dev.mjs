// Builds extension-dev/: the store extension plus localhost:3000, for "Load unpacked" while
// developing. The shipped manifest in extension/ never carries a dev host.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const src = new URL("../extension/", import.meta.url);
const out = new URL("../extension-dev/", import.meta.url);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(src, out, { recursive: true });

const manifest = JSON.parse(readFileSync(new URL("manifest.json", src), "utf8"));
const dev = "http://localhost:3000/*";
manifest.name += " (dev)";
manifest.host_permissions.push(dev);
manifest.content_scripts[0].matches.push(dev);
writeFileSync(new URL("manifest.json", out), JSON.stringify(manifest, null, 2));
console.log("extension-dev/ ready: load it unpacked from chrome://extensions");
