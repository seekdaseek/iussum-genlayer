// node scripts/e2e.mjs deploy | judge <label> <variant> [until]
import fs from "node:fs";
import path from "node:path";
import { ROOT, client, track, save, sleep } from "./lib.mjs";
import { makeBundle } from "./bundle.mjs";

const [cmd, label, variant = "model", until = "FINALIZED"] = process.argv.slice(2);
const { c, account } = client("studionet");
const RPC = "https://api.devnet.solana.com";

if (cmd === "deploy") {
  const code = fs.readFileSync(path.join(ROOT, "contracts/mandate_court.py"), "utf8");
  const hash = await c.deployContract({ code, args: [RPC, 65536n] });
  const r = await track(c, hash, { until: "FINALIZED" });
  const address = r.tx?.data?.contract_address ?? r.tx?.to_address;
  const out = { hash, address, seen: r.seen, last: r.last, resultName: r.tx?.resultName ?? r.tx?.result };
  save("p1-deploy.json", { ...out, tx: r.tx });
  console.log(JSON.stringify(out));
  process.exit(0);
}

const address = JSON.parse(fs.readFileSync(path.join(ROOT, "results/p1-deploy.json"), "utf8")).address;
let b;
if (variant === "model") b = makeBundle();
else if (variant === "scope") b = makeBundle({ mandateOver: { per_payment_max: "9999" } });
else if (variant === "hash") { b = makeBundle(); b.sha = "0".repeat(64); }
else throw new Error("variant");
const resolver = variant === "model" ? JSON.stringify({ liable: "principal", reason: "in_scope", verdict: "invalid" }) : "";
const t0 = Date.now();
let hash;
try { hash = await c.writeContract({ address, functionName: "judge", args: [b.json, b.sha, resolver, label], value: 0n }); }
catch (e) { console.log(JSON.stringify({ label, submitError: String(e?.shortMessage ?? e?.message).slice(0, 300) })); process.exit(0); }
const r = await track(c, hash, { until, everyMs: Number(process.env.POLL_MS ?? 3000) });
const tx = r.tx ?? {};
const cd = tx.consensus_data ?? {};
const leader = Array.isArray(cd.leader_receipt) ? cd.leader_receipt[0] : cd.leader_receipt;
const rec = {
  label, variant, address, hash, bundleBytes: Buffer.byteLength(b.json), bundleSha: b.sha, seen: r.seen, last: r.last,
  statusName: tx.statusName, resultName: tx.resultName ?? tx.result, votes: cd.votes ?? null,
  rotations: tx.rotation_count ?? tx.consensus_history ?? null, numRounds: tx.num_of_rounds ?? null,
  leader: leader ? { model: leader.node_config?.primary_model?.model, exec: leader.execution_result, status: leader.result?.status, payload: leader.result?.payload, stderr: String(leader.genvm_result?.stderr ?? "").slice(0, 1500), stdout: String(leader.genvm_result?.stdout ?? "").slice(0, 500) } : null,
  validators: (cd.validators ?? []).map((v) => ({ model: v.node_config?.primary_model?.model, vote: v.vote, exec: v.execution_result, err: v.genvm_result?.error_code ?? null, stderr: String(v.genvm_result?.stderr ?? "").slice(0, 300) })),
};
try { rec.stored = await c.readContract({ address, functionName: "get_result", args: [b.sha + ":" + label], jsonSafeReturn: true }); } catch (e) { rec.readErr = String(e.message).slice(0, 200); }
save(`p1-${label}.json`, rec);
console.log(JSON.stringify({ label, variant, hash, last: r.last, seen: r.seen, exec: rec.leader?.exec, votes: Object.values(rec.votes ?? {}).join("/"), stored: rec.stored?.slice?.(0, 400), stderr: rec.leader?.exec === "ERROR" ? rec.leader.stderr.slice(-500) : undefined }));
