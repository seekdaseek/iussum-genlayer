// Deploy the SLA court on studionet and judge the cases in sla/cases, ONE AT A TIME (the 429 lesson).
// usage: node scripts/sla-run.mjs deploy | judge [caseId ...] [--runs N] | all
import fs from "node:fs";
import path from "node:path";
import { ROOT, client, sleep, jsonSafe } from "./lib.mjs";

const CASES = path.join(ROOT, "sla/cases");
const INST = path.join(ROOT, "results/sla-instance.json");
const ROWS = path.join(ROOT, "results/sla-rows.jsonl");
const modelOf = (r) => r?.node_config?.primary_model?.model ?? r?.node_config?.model ?? null;
export const PAY_TO = { solana: "4a8o45skRPcyjAdyR8yES215Swvh8uTpZD6KLarhxCJ7", base: "0x22DB3A9686EE5261e7Bf3ed4f91277232E8076e6" };
export const ARGS = (pub) => ["https://api.mainnet-beta.solana.com", "https://mainnet.base.org", "https://x402.ochinimus.app/api/status", 65536n, pub, PAY_TO.solana, PAY_TO.base];

async function waitFor(c, hash, until, ms = 20 * 60_000) {
  const t0 = Date.now(), seen = {}; let tx, last = null;
  while (Date.now() - t0 < ms) {
    try {
      tx = await c.getTransaction({ hash });
      const s = tx.statusName; if (s !== last) { seen[s] = Date.now() - t0; last = s; }
      if (s === until || (until === "ACCEPTED" && s === "FINALIZED") || s === "UNDETERMINED" || s === "CANCELED") break;
    } catch {}
    await sleep(4000);
  }
  return { tx, seen };
}

export async function deploy() {
  const { c } = client("studionet");
  const code = fs.readFileSync(path.join(ROOT, "contracts/sla_court.py"), "utf8");
  const pub = fs.readFileSync(path.join(CASES, "seller.pub"), "utf8").trim();
  const hash = await c.deployContract({ code, args: ARGS(pub) });
  const { tx, seen } = await waitFor(c, hash, "FINALIZED");
  const address = tx?.data?.contract_address ?? tx?.to_address;
  const inst = { address, deploy_tx: hash, seller_key: pub, deployed_at: new Date().toISOString(), seen };
  fs.writeFileSync(INST, JSON.stringify(inst, null, 1) + "\n");
  console.log("deployed", address, hash);
  return inst;
}

export async function judgeCase(id, tag, until = "FINALIZED") {
  const inst = JSON.parse(fs.readFileSync(INST, "utf8"));
  const doc = JSON.parse(fs.readFileSync(path.join(CASES, id + ".json"), "utf8"));
  const { c } = client("studionet");
  const row = { case_id: id, tag, address: inst.address, bundle_sha: doc.sha, bundle_bytes: Buffer.byteLength(doc.bundle_json), expected: doc.expected, started_at: new Date().toISOString() };
  let hash;
  try { hash = await c.writeContract({ address: inst.address, functionName: "judge", args: [doc.bundle_json, doc.sha, tag], value: 0n }); }
  catch (e) { row.submit_error = String(e?.shortMessage ?? e?.message).slice(0, 300); fs.appendFileSync(ROWS, JSON.stringify(row) + "\n"); return row; }
  row.tx = hash;
  const { tx, seen } = await waitFor(c, hash, until);
  const cd = tx?.consensus_data ?? {};
  const leader = Array.isArray(cd.leader_receipt) ? cd.leader_receipt[0] : cd.leader_receipt;
  row.status = tx?.statusName; row.seen = seen; row.rotations = tx?.rotation_count ?? null; row.num_rounds = tx?.num_of_rounds ?? null;
  row.vote_tally = Object.values(cd.votes ?? {}).reduce((a, v) => ((a[v] = (a[v] ?? 0) + 1), a), {});
  row.leader_model = modelOf(leader);
  row.agreeing_models = (cd.validators ?? []).filter((v) => v.vote === "agree").map(modelOf);
  row.exec = leader?.execution_result ?? null;
  if (leader?.execution_result === "ERROR") row.leader_stderr_tail = String(leader?.genvm_result?.stderr ?? "").slice(-400);
  try {
    const stored = await c.readContract({ address: inst.address, functionName: "get_result", args: [doc.sha + ":" + tag], jsonSafeReturn: true });
    row.stored = stored ? JSON.parse(stored) : null;
  } catch (e) { row.read_err = String(e.message).slice(0, 200); }
  const st = row.stored;
  row.result = st ? [st.verdict, st.reason, st.path] : null;
  row.match = doc.expected && row.result ? JSON.stringify(doc.expected) === JSON.stringify(row.result) : null;
  fs.appendFileSync(ROWS, JSON.stringify(jsonSafe(row)) + "\n");
  console.log(JSON.stringify({ case: id, tx: row.tx, status: row.status, result: row.result, refusal: st?.refusal, match: row.match, leader: row.leader_model, votes: row.vote_tally, rot: row.rotations, err: row.submit_error ?? row.leader_stderr_tail?.slice(-160) }));
  return row;
}

if (import.meta.url === "file://" + process.argv[1]) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "deploy") await deploy();
  else if (cmd === "judge" || cmd === "all") {
    const ids = cmd === "all" ? JSON.parse(fs.readFileSync(path.join(CASES, "index.json"), "utf8")).map((x) => x.id) : rest.filter((x) => !x.startsWith("--"));
    const runs = Number((rest.find((x) => x.startsWith("--runs=")) ?? "--runs=1").split("=")[1]);
    for (const id of ids) for (let i = 1; i <= runs; i++) await judgeCase(id, "r" + Date.now().toString(36) + i);
  }
}
