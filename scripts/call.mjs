// node scripts/call.mjs <chain> <address> <label> <method> '<jsonArgs>' [until]
// Sends one write, tracks it, writes results/<label>.json, prints a one-line summary.
// An argument of the form {"$repeat":["x", N]} expands to "x" repeated N times (size tests).
import { client, track, save } from "./lib.mjs";

const [net, address, label, method, argsJson = "[]", until = "FINALIZED"] = process.argv.slice(2);
const { c, account } = client(net);
const args = JSON.parse(argsJson).map((a) => (a && a.$repeat ? a.$repeat[0].repeat(a.$repeat[1]) : a));
const argBytes = args.reduce((n, a) => n + Buffer.byteLength(typeof a === "string" ? a : JSON.stringify(a)), 0);

const out = { net, address, method, argBytes, sender: account.address, submittedAt: new Date().toISOString() };
let hash;
try {
  hash = await c.writeContract({ address, functionName: method, args, value: 0n });
} catch (e) {
  out.submitError = String(e?.shortMessage ?? e?.message ?? e).slice(0, 600);
  out.submitErrorDetails = String(e?.details ?? e?.cause?.message ?? "").slice(0, 600);
  save(`${label}.json`, out);
  console.log(JSON.stringify({ label, argBytes, submitError: out.submitError.slice(0, 200) }));
  process.exit(0);
}
out.hash = hash;
const r = await track(c, hash, { until });
const tx = r.tx ?? {};
const cd = tx.consensus_data ?? {};
const leader = Array.isArray(cd.leader_receipt) ? cd.leader_receipt[0] : cd.leader_receipt;
out.seen = r.seen; out.last = r.last; out.pollErrors = r.pollErrors;
out.votes = cd.votes ?? null;
out.leader = leader ? {
  address: leader.node_config?.address,
  model: leader.node_config?.primary_model?.model ?? leader.node_config?.model,
  provider: leader.node_config?.primary_model?.provider ?? leader.node_config?.provider,
  execution_result: leader.execution_result,
  result_status: leader.result?.status,
  result_payload: leader.result?.payload,
  eq_outputs: leader.eq_outputs,
  stderr: String(leader.genvm_result?.stderr ?? "").slice(0, 800),
  processing_time: leader.processing_time,
} : null;
out.validators = (cd.validators ?? []).map((v) => ({
  address: v.node_config?.address,
  model: v.node_config?.primary_model?.model ?? v.node_config?.model,
  provider: v.node_config?.primary_model?.provider ?? v.node_config?.provider,
  vote: v.vote, execution_result: v.execution_result,
  error_code: v.genvm_result?.error_code ?? null,
  processing_time: v.processing_time,
}));
out.status = tx.status; out.statusName = tx.statusName; out.result = tx.result; out.resultName = tx.resultName;
try { out.stateAfter = await c.readContract({ address, functionName: "get", args: [], jsonSafeReturn: true }); } catch (e) { out.readErr = String(e.message).slice(0, 300); }
save(`${label}.json`, out);
const tally = {}; for (const v of Object.values(out.votes ?? {})) tally[v] = (tally[v] ?? 0) + 1;
console.log(JSON.stringify({ label, hash, argBytes, last: r.last, seen: r.seen, votes: tally, leaderExec: out.leader?.execution_result, state: out.stateAfter }));
