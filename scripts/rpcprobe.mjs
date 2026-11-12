import fs from "node:fs";
import path from "node:path";
import { ROOT, client, track, save } from "./lib.mjs";
const { c } = client("studionet");
const code = fs.readFileSync(path.join(ROOT, "contracts/rpc_probe.py"), "utf8");
const dh = await c.deployContract({ code, args: [] });
const d = await track(c, dh, { until: "FINALIZED" });
const address = d.tx?.data?.contract_address ?? d.tx?.to_address;
console.log("probe", address);
const k = JSON.parse(fs.readFileSync(path.join(ROOT, "cases/real/real-5-scope-overcap.json")));
const o = { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "finalized" };
const one = (sig, opts, id = "x1") => ({ jsonrpc: "2.0", id, method: "getTransaction", params: [sig, opts] });
const variants = {
  "A single payment, same params": one(k.payment_tx, o),
  "B single payment, params + minContextSlot": one(k.payment_tx, { ...o, minContextSlot: 0 }),
  "C single payment, commitment confirmed": one(k.payment_tx, { ...o, commitment: "confirmed" }),
  "D single grant, same params": one(k.grant_tx, o),
  "E real-1 payment, same params": one(JSON.parse(fs.readFileSync(path.join(ROOT, "cases/real/real-1-onpurpose-quote.json"))).payment_tx, o),
  "F getSignatureStatuses payment": { jsonrpc: "2.0", id: 1, method: "getSignatureStatuses", params: [[k.payment_tx]] },
};
const out = {};
for (const [name, body] of Object.entries(variants)) {
  const h = await c.writeContract({ address, functionName: "send", args: ["https://api.devnet.solana.com", JSON.stringify(body)], value: 0n });
  await track(c, h, { until: "ACCEPTED", everyMs: 4000 });
  out[name] = await c.readContract({ address, functionName: "get", args: [] });
  console.log(name, "=>", out[name].slice(0, 200));
}
save("rpcprobe.json", { address, out });
