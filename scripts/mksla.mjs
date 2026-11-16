// Build web/sla: cases.json, the contract copy, and ?v= stamps on the page's own files. Run: node scripts/mksla.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ROOT } from "./lib.mjs";
import { slaPageData } from "./mksla-lib.mjs";

const out = path.join(ROOT, "web/sla");
const cases = JSON.parse(fs.readFileSync(path.join(ROOT, "sla/cases/index.json"), "utf8")).map((x) => JSON.parse(fs.readFileSync(path.join(ROOT, "sla/cases", x.id + ".json"), "utf8")));
const rows = fs.readFileSync(path.join(ROOT, "results/sla-rows.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const instance = JSON.parse(fs.readFileSync(path.join(ROOT, "results/sla-instance.json"), "utf8"));
fs.mkdirSync(path.join(out, "contract"), { recursive: true });
fs.copyFileSync(path.join(ROOT, "contracts/sla_court.py"), path.join(out, "contract/sla_court.py"));
fs.writeFileSync(path.join(out, "cases.json"), JSON.stringify(slaPageData({ cases, rows, instance }), null, 1) + "\n");
const strip = (s) => s.replace(/\?v=[0-9a-z]+/g, "");
const rd = (f) => fs.readFileSync(path.join(out, f), "utf8");
const h = crypto.createHash("sha256");
for (const f of ["index.html", "sla.js", "cases.json"]) h.update(f + "\0" + strip(rd(f)) + "\0");
for (const f of ["lib.mjs", "style.css", "vendor/genlayer.js"]) h.update(fs.readFileSync(path.join(ROOT, "web", f)));
const v = h.digest("hex").slice(0, 10);
fs.writeFileSync(path.join(out, "index.html"), strip(rd("index.html")).replace(/(\.\.\/style\.css|\.\.\/vendor\/genlayer\.js|sla\.js)(?=["'])/g, `$1?v=${v}`));
fs.writeFileSync(path.join(out, "sla.js"), strip(rd("sla.js")).replace(/(\.\.\/lib\.mjs|cases\.json)(?=["'])/g, `$1?v=${v}`));
console.log("web/sla built, version", v, "cases", cases.length);
