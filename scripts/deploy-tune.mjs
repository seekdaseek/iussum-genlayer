import { deploy } from "./runner.mjs";
for (const n of process.argv.slice(2)) { const i = await deploy(n, "bundle", 65536); console.log(n, i.address); }
