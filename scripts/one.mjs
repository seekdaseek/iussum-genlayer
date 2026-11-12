import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.mjs";
import { judge, short } from "./runner.mjs";
const [id, tag, until = "ACCEPTED"] = process.argv.slice(2);
const k = JSON.parse(fs.readFileSync(path.join(ROOT, "cases/real", id + ".json")));
const bundle = { v: "iussum-genlayer/0.2", mandate: k.mandate, grant_tx: k.grant_tx, payment: k.payment, delivery: { delivered: k.delivered } };
const r = await judge({ inst: "live", caseId: k.id, bundle, tag, expected: k.expect, setName: "probe", until, note: "diagnosing chain_unreachable" });
console.log(short(r), JSON.stringify(r.stored?.http));
