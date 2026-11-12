import fs from "node:fs";
import path from "node:path";
import { ROOT, client, track } from "./lib.mjs";
const { c } = client("studionet");
const code = fs.readFileSync(path.join(ROOT, "contracts/rpc_probe.py"), "utf8");
const h = await c.deployContract({ code, args: [] });
const d = await track(c, h, { until: "ACCEPTED" });
const cd = d.tx.consensus_data; const l = Array.isArray(cd.leader_receipt) ? cd.leader_receipt[0] : cd.leader_receipt;
console.log(d.last, l.execution_result, String(l.genvm_result?.stderr).slice(-600));
