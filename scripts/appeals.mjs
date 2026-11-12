// node scripts/appeals.mjs <instance> <caseId>...   For each case: submit (up to 3 times) until the ACCEPTED result differs from the expected
// triple (a flip), then appeal that transaction inside its window; if no attempt flips, appeal the last one anyway ("held").
import fs from "node:fs";
import path from "node:path";
import { ROOT, client, sleep, jsonSafe } from "./lib.mjs";
import { canon, sha256 } from "./bundle.mjs";
import { instance, ROWS } from "./runner.mjs";

const [instName, ...ids] = process.argv.slice(2);
const inst = instance(instName);
const { c } = client("studionet");
const C = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, "sets/setC.json"))).map((x) => [x.id, x]));
const modelOf = (r) => r?.node_config?.primary_model?.model ?? r?.node_config?.model ?? null;

async function snapshot(hash) {
  const tx = await c.getTransaction({ hash }); const cd = tx.consensus_data ?? {};
  const leader = Array.isArray(cd.leader_receipt) ? cd.leader_receipt[0] : cd.leader_receipt;
  return { status: tx.statusName, votes: Object.values(cd.votes ?? {}), n_receipts: (cd.leader_receipt ?? []).length, validators: (cd.validators ?? []).map((v) => ({ m: modelOf(v), v: v.vote })), leader: modelOf(leader), rotations: tx.rotation_count, rounds: tx.num_of_rounds, appealed: tx.appealed, appeal_failed: tx.appeal_failed, last_round: tx.last_round && { round: tx.last_round.round, committed: tx.last_round.votes_committed, revealed: tx.last_round.votes_revealed, appeal_bond: tx.last_round.appeal_bond, result: tx.last_round.result, validators: tx.last_round.round_validators?.length } };
}
const stored = async (sha, tag) => { try { const s = await c.readContract({ address: inst.address, functionName: "get_result", args: [sha + ":" + tag], jsonSafeReturn: true }); return s ? JSON.parse(s) : null; } catch { return null; } };

for (const id of ids) {
  const k = C[id]; const json = canon(k.bundle); const sha = sha256(json);
  const attempts = [];
  for (let a = 1; a <= 3; a++) {
    const tag = `AP-${id.slice(2)}-a${a}`;
    const t0 = Date.now();
    const hash = await c.writeContract({ address: inst.address, functionName: "judge", args: [json, sha, "", tag], value: 0n });
    let snap, st = null, tAcc = null;
    for (let i = 0; i < 120; i++) { await sleep(3500); try { snap = await snapshot(hash); } catch { continue; } if (snap.status === "ACCEPTED" || snap.status === "FINALIZED") { tAcc = Date.now() - t0; break; } }
    st = await stored(sha, tag);
    const triple = st ? [st.verdict, st.liable, st.reason] : null;
    const flipped = triple && JSON.stringify(triple) !== JSON.stringify(k.expected);
    attempts.push({ tag, hash, accepted_ms: tAcc, triple, flipped, leader: snap?.leader, votes_before: snap?.votes });
    if (flipped || a === 3) {
      const rec = { case_id: id, instance: instName, address: inst.address, expected: k.expected, attempts, appealed_tx: hash, appeal_tag: tag, flipped_before_appeal: !!flipped, pre: { snap, stored: st } };
      try { rec.canAppeal = await c.canAppeal({ txId: hash }); } catch (e) { rec.canAppealErr = String(e.message).slice(0, 160); }
      const t1 = Date.now();
      try { const r = await c.appealTransaction({ txId: hash, value: 0n }); rec.appeal_sent_ms = Date.now() - t0; rec.appeal_result = typeof r === "string" ? r : "ok"; } catch (e) { rec.appeal_error = String(e?.shortMessage ?? e?.message).slice(0, 300); }
      let post = null;
      for (let i = 0; i < 160; i++) { await sleep(4000); try { post = await snapshot(hash); } catch { continue; } if (post.status === "FINALIZED") break; }
      rec.final_ms = Date.now() - t0;
      rec.post = post; rec.post_stored = await stored(sha, tag);
      const t2 = rec.post_stored ? [rec.post_stored.verdict, rec.post_stored.liable, rec.post_stored.reason] : null;
      rec.after_appeal_triple = t2; rec.corrected = flipped ? JSON.stringify(t2) === JSON.stringify(k.expected) : null; rec.held = !flipped ? JSON.stringify(t2) === JSON.stringify(k.expected) : null;
      fs.appendFileSync(path.join(ROOT, "results", "appeals.jsonl"), JSON.stringify(jsonSafe(rec)) + "\n");
      console.log(id, JSON.stringify({ attempts: attempts.map((x) => [x.tag, x.triple, x.flipped]), appeal: rec.appeal_result ?? rec.appeal_error, canAppeal: rec.canAppeal ?? rec.canAppealErr, after: t2, corrected: rec.corrected, held: rec.held, votes: post?.votes?.length, rounds: post?.rounds, last_round: post?.last_round }).slice(0, 700));
      break;
    }
  }
}
