import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.mjs";
import { deploy } from "./runner.mjs";
const test = fs.readFileSync(path.join(ROOT, "sets/test-seller.pub"), "utf8").trim();
const gate = JSON.parse(fs.readFileSync(path.join(ROOT, "cases/real-receipt/rr-1-seller-overcap.json"))).seller_pub;
for (const n of ["live4-a", "live4-b", "live4-c"]) { const i = await deploy(n, "rpc", 65536, `${test},${gate}`); console.log(n, i.address, i.deploy_tx, i.seen.FINALIZED); }
