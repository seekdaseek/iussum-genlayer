// Stamps ?v=<content hash> on every asset URL in index.html and app.js, so a browser never serves a stale file
// (Cloudflare raises the browser cache of static files to 4 hours whatever the origin says).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const strip = (s) => s.replace(/\?v=[0-9a-z]+/g, "");
export function stampVersion(dir) {
  const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");
  const h = crypto.createHash("sha256");
  for (const f of ["index.html", "app.js", "lib.mjs", "style.css", "cases.json"]) h.update(f + "\0" + strip(read(f)) + "\0");
  h.update(fs.readFileSync(path.join(dir, "vendor/genlayer.js")));
  const v = h.digest("hex").slice(0, 10);
  const put = (f, s) => fs.writeFileSync(path.join(dir, f), s);
  put("index.html", strip(read("index.html")).replace(/(style\.css|vendor\/genlayer\.js|app\.js)(?=["'])/g, `$1?v=${v}`));
  put("app.js", strip(read("app.js")).replace(/(\.\/lib\.mjs|cases\.json|contract\/mandate_court\.py)(?=["'])/g, (m) => (m === "contract/mandate_court.py" ? m : `${m}?v=${v}`)));
  return v;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log("version", stampVersion(path.resolve(process.argv[2] ?? "web")));
