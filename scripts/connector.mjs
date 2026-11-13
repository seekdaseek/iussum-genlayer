// node scripts/connector.mjs <case.json> <instance>
// Takes a real iussum devnet case (mandate, grant, payment, signed seller receipt, iussum's own verdict and verdict_id), builds the bundle, submits it to the
// instance, waits for FINALIZED, applies the UNDETERMINED rule (connector-lib.mjs) and writes the GenLayer tx ids next to iussum's verdict_id.
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.mjs";
import { judge } from "./runner.mjs";
import { nextStep, outcome } from "./connector-lib.mjs";

const [casePath, instName] = process.argv.slice(2);
const k = JSON.parse(fs.readFileSync(casePath, "utf8"));
import { bundleFromCase } from "./demo-lib.mjs";
const bundle = bundleFromCase(k);
const attempts = [];
while (nextStep(attempts) !== "stop") {
  const n = attempts.length + 1;
  const row = await judge({ inst: instName, caseId: k.id, bundle, tag: `cn${n}-${Date.now().toString(36).slice(-6)}`, expected: k.expected_court ?? null, setName: "connector", note: `connector attempt ${n}`, pollMs: 6000 });
  attempts.push({ tx: row.tx ?? null, status: row.status ?? null, result: row.result ?? null, error: row.submit_error ?? null, accepted_ms: row.accepted_ms, final_ms: row.final_ms, leader: row.leader_model, agreeing: row.agreeing_models, rotations: row.rotations, stored: row.stored });
  if (attempts[attempts.length - 1].error) break;
}
const o = outcome(attempts);
const out = { case_id: k.id, written_at: new Date().toISOString(), iussum: k.iussum, payment_tx: k.payment?.tx_sig ?? k.payment_tx, grant_tx: k.grant_tx, receipt_seller: (k.receipt ?? k.bundle?.delivery?.receipt)?.seller ?? null,
  genlayer: { instance: instName, address: JSON.parse(fs.readFileSync(path.join(ROOT, "results/instances.json")))[instName].address, chain_source: "rpc", attempts }, outcome: o, expected_court: k.expected_court ?? null,
  link: { iussum_verdict_id: k.iussum?.verdict_id ?? null, genlayer_txs: o.txs } };
fs.mkdirSync(path.join(ROOT, "results/connector"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "results/connector", `${k.id}.json`), JSON.stringify(out, null, 1) + "\n");
const idx = path.join(ROOT, "results/connector-index.json");
const all = fs.existsSync(idx) ? JSON.parse(fs.readFileSync(idx)) : {};
all[k.iussum?.verdict_id ?? k.id] = { case_id: k.id, genlayer_txs: o.txs, outcome: [o.verdict, o.liable, o.reason], source: o.source };
fs.writeFileSync(idx, JSON.stringify(all, null, 1) + "\n");
console.log(JSON.stringify({ case: k.id, iussum_verdict_id: k.iussum?.verdict_id, outcome: [o.verdict, o.liable, o.reason], source: o.source, txs: o.txs, status: attempts.map((a) => a.status) }));
