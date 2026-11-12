import { deploy } from "./runner.mjs";
for (const [n, cs, mb] of [["live", "rpc", 65536], ["replay-a", "bundle", 65536], ["replay-b", "bundle", 65536], ["replay-c", "bundle", 65536], ["trunc", "bundle", 450000]]) {
  const i = await deploy(n, cs, mb);
  console.log(n, i.address, i.seen.FINALIZED);
}
