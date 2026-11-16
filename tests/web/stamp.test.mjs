// Cloudflare stretches browser cache to 4 h for static files, so every asset URL carries a content version (written before scripts/stamp-web.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stampVersion } from "../../scripts/stamp-web.mjs";

function fixture() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "stamp-"));
  fs.writeFileSync(path.join(d, "index.html"), '<link rel="stylesheet" href="style.css?v=old"><script src="vendor/genlayer.js?v=old"></script><script type="module" src="app.js?v=old"></script>');
  fs.writeFileSync(path.join(d, "app.js"), 'import { x } from "./lib.mjs?v=old"; fetch("cases.json?v=old");');
  fs.writeFileSync(path.join(d, "lib.mjs"), "export const x = 1;");
  fs.writeFileSync(path.join(d, "style.css"), "body{}");
  fs.writeFileSync(path.join(d, "cases.json"), "{}");
  fs.mkdirSync(path.join(d, "vendor")); fs.writeFileSync(path.join(d, "vendor/genlayer.js"), "//");
  return d;
}
test("all asset references get the same new version, and it is a content hash", () => {
  const d = fixture();
  const v = stampVersion(d);
  assert.match(v, /^[0-9a-f]{10}$/);
  const all = fs.readFileSync(path.join(d, "index.html"), "utf8") + fs.readFileSync(path.join(d, "app.js"), "utf8");
  assert.equal([...all.matchAll(/\?v=([0-9a-z]+)/g)].length, 5);
  assert.ok([...all.matchAll(/\?v=([0-9a-z]+)/g)].every((m) => m[1] === v));
});
test("stamping twice changes nothing; changing a file changes the version", () => {
  const d = fixture();
  const v1 = stampVersion(d), v2 = stampVersion(d);
  assert.equal(v1, v2);
  fs.writeFileSync(path.join(d, "lib.mjs"), "export const x = 2;");
  assert.notEqual(stampVersion(d), v1);
});
test("the real web folder is stamped consistently", () => {
  const h = fs.readFileSync("web/index.html", "utf8") + fs.readFileSync("web/app.js", "utf8");
  const vs = new Set([...h.matchAll(/\?v=([0-9a-z]+)/g)].map((m) => m[1]));
  assert.equal(vs.size, 1);
});
