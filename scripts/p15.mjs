import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.mjs";
import { deploy, judge, short } from "./runner.mjs";
const cmd = process.argv[2];
if (cmd === "deploy") { const i = await deploy("live", "rpc", 65536); console.log(JSON.stringify(i)); process.exit(0); }
const files = fs.readdirSync(path.join(ROOT, "cases/real")).filter((f) => f.endsWith(".json")).sort();
for (const f of files) {
  const k = JSON.parse(fs.readFileSync(path.join(ROOT, "cases/real", f)));
  const bundle = { v: "iussum-genlayer/0.2", mandate: k.mandate, grant_tx: k.grant_tx, payment: k.payment, delivery: { delivered: k.delivered } };
  const r = await judge({ inst: "live", caseId: k.id, bundle, tag: "r1", expected: k.expect, setName: "phase1.5" });
  console.log(short(r));
}
