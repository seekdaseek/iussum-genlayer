// Shared runner for phase 1.5 / 2. One submission at a time; every call appends a row to results/rows.jsonl.
import fs from "node:fs";
import path from "node:path";
import { ROOT, client, sleep, jsonSafe } from "./lib.mjs";
import { canon, sha256 } from "./bundle.mjs";

export const ROWS = process.env.ROWS_FILE ?? path.join(ROOT, "results", "rows.jsonl");
export const INSTANCES = process.env.INSTANCES_FILE ?? path.join(ROOT, "results", "instances.json");
const loadInst = () => (fs.existsSync(INSTANCES) ? JSON.parse(fs.readFileSync(INSTANCES, "utf8")) : {});
export const instance = (name) => { const i = loadInst()[name]; if (!i) throw new Error("no instance " + name); return i; };
const saveInst = (name, v) => { const all = loadInst(); all[name] = v; fs.writeFileSync(INSTANCES, JSON.stringify(all, null, 2) + "\n"); };

export async function deploy(name, chainSource, maxBytes, sellerKeys = "", rpcUrl = "https://api.devnet.solana.com") {
  const { c } = client("studionet");
  const code = fs.readFileSync(path.join(ROOT, "contracts/mandate_court.py"), "utf8");
  const t0 = Date.now();
  const hash = await c.deployContract({ code, args: [rpcUrl, BigInt(maxBytes), chainSource, sellerKeys] });
  let tx, seen = {};
  for (let i = 0; i < 300; i++) {
    try { tx = await c.getTransaction({ hash }); const s = tx.statusName; if (!(s in seen)) seen[s] = Date.now() - t0; if (s === "FINALIZED") break; } catch {}
    await sleep(3000);
  }
  const address = tx?.data?.contract_address ?? tx?.to_address;
  const inst = { name, chain_source: chainSource, max_bytes: maxBytes, seller_keys: sellerKeys, rpc_url: rpcUrl, address, deploy_tx: hash, deployed_at: new Date().toISOString(), seen };
  saveInst(name, inst);
  return inst;
}

const modelOf = (r) => r?.node_config?.primary_model?.model ?? r?.node_config?.model ?? null;

// bundleObj is the plain object; it is canonicalised here. Returns the row.
export async function judge({ inst: instName, caseId, bundle, resolver = "", tag, expected = null, setName = "", note = "", until = "FINALIZED", pollMs = 4000, hashOverride = null }) {
  const inst = instance(instName);
  const { c } = client("studionet");
  const json = canon(bundle); const sha = hashOverride ?? sha256(json);
  const row = { case_id: caseId, set: setName, instance: instName, address: inst.address, chain_source: inst.chain_source, tag, bundle_bytes: Buffer.byteLength(json), bundle_sha: sha, expected, note, started_at: new Date().toISOString() };
  const t0 = Date.now();
  let hash;
  try { hash = await c.writeContract({ address: inst.address, functionName: "judge", args: [json, sha, resolver, tag], value: 0n }); }
  catch (e) { row.submit_error = String(e?.shortMessage ?? e?.message).slice(0, 300); fs.appendFileSync(ROWS, JSON.stringify(row) + "\n"); return row; }
  row.tx = hash;
  const seen = {}; let tx, last = null, errs = 0;
  while (Date.now() - t0 < 20 * 60_000) {
    try {
      tx = await c.getTransaction({ hash });
      const s = tx.statusName; if (s !== last) { seen[s] = Date.now() - t0; last = s; }
      if (s === until || (until === "ACCEPTED" && s === "FINALIZED")) break;
      if (s === "UNDETERMINED" || s === "CANCELED") break;
    } catch { errs++; if (errs > 60) break; }
    await sleep(pollMs);
  }
  const cd = tx?.consensus_data ?? {};
  const leader = Array.isArray(cd.leader_receipt) ? cd.leader_receipt[0] : cd.leader_receipt;
  const vals = cd.validators ?? [];
  row.status = tx?.statusName; row.seen = seen; row.accepted_ms = seen.ACCEPTED ?? null; row.final_ms = seen.FINALIZED ?? null;
  row.rotations = tx?.rotation_count ?? null; row.num_rounds = tx?.num_of_rounds ?? null; row.appealed = tx?.appealed ?? null;
  row.votes = cd.votes ?? null;
  row.vote_tally = Object.values(cd.votes ?? {}).reduce((a, v) => ((a[v] = (a[v] ?? 0) + 1), a), {});
  row.leader_model = modelOf(leader);
  row.agreeing_models = vals.filter((v) => v.vote === "agree").map(modelOf);
  row.exec = leader?.execution_result ?? null;
  row.leader_stderr_tail = leader?.execution_result === "ERROR" ? String(leader?.genvm_result?.stderr ?? "").slice(-400) : undefined;
  try {
    const stored = await c.readContract({ address: inst.address, functionName: "get_result", args: [sha + ":" + tag], jsonSafeReturn: true });
    row.stored = stored ? JSON.parse(stored) : null;
  } catch (e) { row.read_err = String(e.message).slice(0, 200); }
  const st = row.stored;
  row.result = st ? [st.verdict, st.liable, st.reason] : null;
  row.result_path = st?.path ?? null;
  row.chain_unreachable = st?.reason === "chain_unreachable";
  row.match = expected && row.result ? JSON.stringify(expected) === JSON.stringify(row.result) : null;
  fs.appendFileSync(ROWS, JSON.stringify(jsonSafe(row)) + "\n");
  return row;
}

export const short = (r) => JSON.stringify({ case: r.case_id, tag: r.tag, tx: r.tx?.slice(0, 12), status: r.status, acc: r.accepted_ms, fin: r.final_ms, rot: r.rotations, votes: r.vote_tally, leader: r.leader_model, result: r.result, expected: r.expected, match: r.match, err: r.submit_error ?? r.read_err ?? r.leader_stderr_tail?.slice(-120) });
