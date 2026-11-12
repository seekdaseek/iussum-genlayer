// Builds results/jobs.json: every phase 2 run, assigned to a worker. One worker = one instance = one submission at a time.
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.mjs";
const S = (k) => JSON.parse(fs.readFileSync(path.join(ROOT, "sets", `set${k}.json`)));
const A = S("A"), B = S("B"), C = S("C"), T = S("T");
const replay = ["replay-a", "replay-b", "replay-c"];
const jobs = [];
const push = (job) => jobs.push(job);
let n = 0;
const rr = () => replay[n++ % 3];
for (let run = 1; run <= 3; run++) {
  for (const c of A) push({ worker: rr(), inst: null, set: "A", case: c.id, expected: c.expected, run, resolver: JSON.stringify({ liable: c.iussum.liable ?? null, reason: c.iussum.reason, verdict: c.iussum.verdict }), file: "A" });
  for (const c of B) push({ worker: rr(), set: "B", case: c.id, expected: c.expected, run, file: "B" });
  if (run === 1) for (const c of C) push({ worker: rr(), set: "C", case: c.id, expected: c.expected, run, file: "C" });
}
// live worker: the six real cases, two more runs each (their first run is the phase 1.5 row), then the truncation instance
const real = fs.readdirSync(path.join(ROOT, "cases/real")).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, "cases/real", f))));
for (const run of [2, 3]) for (const k of real) push({ worker: "live", set: "R", case: k.id, expected: k.expect, run, file: "real", real: true });
for (const run of [1, 2, 3]) for (const c of T) push({ worker: "trunc", set: "T", case: c.id, expected: c.expected, run, file: "T" });
for (const j of jobs) j.inst = j.worker.startsWith("replay") ? j.worker : j.worker === "trunc" ? "trunc" : "live";
fs.writeFileSync(path.join(ROOT, "results", "jobs.json"), JSON.stringify(jobs));
const by = {}; for (const j of jobs) by[j.worker] = (by[j.worker] ?? 0) + 1;
console.log(jobs.length, JSON.stringify(by));
