// Diagnostic: can studionet validators read Solana mainnet and Base public RPCs? One request at a time.
import fs from "node:fs";
import path from "node:path";
import { ROOT, client, track, save } from "./lib.mjs";
const { c } = client("studionet");
const code = fs.readFileSync(path.join(ROOT, "contracts/rpc_probe.py"), "utf8");
const dh = await c.deployContract({ code, args: [] });
const d = await track(c, dh, { until: "FINALIZED" });
const address = d.tx?.data?.contract_address ?? d.tx?.to_address;
console.log("probe", address);
const o = { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "finalized" };
const probes = {
  solana: ["https://api.mainnet-beta.solana.com", { jsonrpc: "2.0", id: "sla-probe-1", method: "getTransaction", params: ["5i6um8xJKLW76M3ArrBsNXNY4oeHoM9ZT9DhEiLqHyTy9YjyjKXtjBT5X4MRqvL5UYvHLzuhQHxJ9aGcT1RxWkJr", o] }],
  "base-receipt": ["https://mainnet.base.org", { jsonrpc: "2.0", id: "sla-probe-2", method: "eth_getTransactionReceipt", params: ["0xc75db1a1d4c1f8b44a3a0285734b876a4a22343bfe58ebd40fd11b9c7969622b"] }],
  "base-block": ["https://mainnet.base.org", { jsonrpc: "2.0", id: "sla-probe-3", method: "eth_getBlockByNumber", params: ["0x375ae02", false] }],
  status: ["https://x402.ochinimus.app/api/status", null],
};
const out = {};
for (const [name, [url, body]] of Object.entries(probes)) {
  const h = await c.writeContract({ address, functionName: "send", args: [url, body ? JSON.stringify(body) : ""], value: 0n });
  await track(c, h, { until: "ACCEPTED", everyMs: 4000 });
  out[name] = await c.readContract({ address, functionName: "get", args: [] });
  console.log(name, "=>", String(out[name]).slice(0, 220));
}
save("slaprobe.json", { address, out });
