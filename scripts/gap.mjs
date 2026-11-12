// Measure the gap the public devnet RPC tolerates: submit real-5 (deterministic, one chain read) after each wait.
import fs from "node:fs";
import path from "node:path";
import { ROOT, sleep } from "./lib.mjs";
import { judge, short } from "./runner.mjs";
const k = JSON.parse(fs.readFileSync(path.join(ROOT, "cases/real/real-5-scope-overcap.json")));
const bundle = { v: "iussum-genlayer/0.2", mandate: k.mandate, grant_tx: k.grant_tx, payment: k.payment, delivery: { delivered: k.delivered } };
const gaps = process.argv.slice(2).map(Number);
for (const g of gaps) {
  await sleep(g * 1000);
  const r = await judge({ inst: "live", caseId: "gap-probe-real-5", bundle, tag: "gap" + g + "-" + Date.now().toString(36).slice(-4), expected: k.expect, setName: "gap-probe", until: "ACCEPTED", note: `waited ${g}s after previous probe finished` });
  console.log(`gap ${g}s ->`, r.stored?.reason, "http", r.stored?.http, "rot", r.rotations, "acc", r.accepted_ms);
}
