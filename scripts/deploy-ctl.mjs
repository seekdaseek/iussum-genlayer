import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.mjs";
process.env.CONTRACT_FILE = path.join(ROOT, "controls/mandate_court_single.py");
process.env.INSTANCES_FILE = path.join(ROOT, "results/instances-control.json");
const { deploy } = await import("./runner.mjs");
const pub = fs.readFileSync(path.join(ROOT, "sets/test-seller.pub"), "utf8").trim();
for (const n of ["ctl-a", "ctl-b", "ctl-c"]) { const i = await deploy(n, "bundle", 65536, pub); console.log(n, i.address, i.deploy_tx, i.seen.FINALIZED); }
