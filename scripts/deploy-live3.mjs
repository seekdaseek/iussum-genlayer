import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.mjs";
import { deploy } from "./runner.mjs";
const k = JSON.parse(fs.readFileSync(path.join(ROOT, "cases/real-receipt/rr-1-seller-overcap.json")));
const i = await deploy("live3", "rpc", 65536, k.seller_pub);
console.log(i.address, i.deploy_tx, i.seen.FINALIZED);
