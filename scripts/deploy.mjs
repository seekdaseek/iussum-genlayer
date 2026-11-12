// node scripts/deploy.mjs <chain>   -> deploys contracts/probe.py, writes results/deploy-<chain>.json
import fs from "node:fs";
import path from "node:path";
import { ROOT, client, track, save, keyFingerprint } from "./lib.mjs";

const net = process.argv[2] ?? "studionet";
const { c, account, chain } = client(net);
const code = fs.readFileSync(path.join(ROOT, "contracts", "probe.py"), "utf8");

const out = { net, chainId: chain.id, rpc: chain.rpcUrls.default.http[0], sender: account.address, key: keyFingerprint(), submittedAt: new Date().toISOString() };
try { out.balance = String(await c.getBalance({ address: account.address })); } catch (e) { out.balanceErr = String(e.message).slice(0, 200); }

const hash = await c.deployContract({ code, args: [] });
out.hash = hash;
const r = await track(c, hash, { until: "FINALIZED" });
out.seen = r.seen; out.last = r.last; out.pollErrors = r.pollErrors;
out.tx = r.tx;
out.address = r.tx?.data?.contract_address ?? r.tx?.recipient ?? r.tx?.to_address ?? null;
const p = save(`deploy-${net}.json`, out);
console.log(JSON.stringify({ hash, address: out.address, seen: out.seen, last: out.last, file: p }));
