import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.mjs";
import { deploy } from "./runner.mjs";
const pub = fs.readFileSync(path.join(ROOT, "sets/test-seller.pub"), "utf8").trim();
for (const n of ["p3-a", "p3-b", "p3-c"]) { const i = await deploy(n, "bundle", 65536, pub); console.log(n, i.address, i.seen.FINALIZED); }
