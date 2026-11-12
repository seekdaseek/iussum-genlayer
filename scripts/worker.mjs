// node scripts/worker.mjs <worker>   Runs that worker's jobs one at a time, skipping jobs already recorded.
import fs from "node:fs";
import path from "node:path";
import { ROOT, sleep } from "./lib.mjs";
import { judge, short, ROWS } from "./runner.mjs";
const worker = process.argv[2];
const jobs = JSON.parse(fs.readFileSync(process.env.JOBS ?? path.join(ROOT, "results/jobs.json"))).filter((j) => j.worker === worker);
const cache = {};
const dirMap = (d) => Object.fromEntries(fs.readdirSync(path.join(ROOT, d)).filter((x) => x.endsWith(".json")).map((x) => { const k = JSON.parse(fs.readFileSync(path.join(ROOT, d, x))); return [k.id, k]; }));
const load = (f) => (cache[f] ??= f === "b2" ? dirMap("cases/b2") : f === "rr" ? dirMap("cases/real-receipt") : f === "real" ? Object.fromEntries(fs.readdirSync(path.join(ROOT, "cases/real")).filter((x) => x.endsWith(".json")).map((x) => { const k = JSON.parse(fs.readFileSync(path.join(ROOT, "cases/real", x))); return [k.id, k]; })) : Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, "sets", `set${f}.json`))).map((c) => [c.id, c])));
const done = () => new Set(fs.existsSync(ROWS) ? fs.readFileSync(ROWS, "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((r) => r.tx && r.status && !r.submit_error && r.stored !== undefined).map((r) => r.tag + "@" + r.instance) : []);
for (const j of jobs) {
  const suf = `-r${j.run}`; const tag = `${j.set}-${j.case.replace(/^[A-Z]-/, "")}`.slice(0, 32 - suf.length) + suf;
  if (done().has(tag + "@" + j.inst)) continue;
  const src = load(j.file)[j.case];
  const bundle = src.bundle ? src.bundle : j.file === "rr" ? { v: "iussum-genlayer/0.2", mandate: src.mandate, grant_tx: src.grant_tx, payment: src.payment, delivery: { receipt: src.receipt } } : j.real ? { v: "iussum-genlayer/0.2", mandate: src.mandate, grant_tx: src.grant_tx, payment: src.payment, delivery: { delivered: src.delivered } } : src.bundle;
  let row;
  for (let attempt = 1; attempt <= 3; attempt++) {
    row = await judge({ inst: j.inst, caseId: j.case, bundle, resolver: j.resolver ?? "", tag, expected: j.expected, setName: j.set, note: j.note ?? (attempt > 1 ? `attempt ${attempt} after a Studio rate limit` : ""), pollMs: 7000 });
    if (!(row.submit_error && /429|rate|limit/i.test(row.submit_error))) break;
    await sleep(75000);
  }
  console.log(worker, short(row).slice(0, 400));
}
console.log(worker, "DONE");
