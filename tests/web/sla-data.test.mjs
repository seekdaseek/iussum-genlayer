import test from "node:test";
import assert from "node:assert/strict";
import { slaPageData } from "../../scripts/mksla-lib.mjs";

const cases = [
  { id: "a", title: "A", network: "solana", tool: "get_sol_price", payment_tx: "S1", expected: ["no_refund", "delivered_ok", "deterministic"], bundle_json: '{"v":"iussum-sla/0.1"}', sha: "h1", chain_facts: { amount: "1000" }, served_at: 5, labels: { payment: "p" } },
  { id: "b", title: "B", network: "base", tool: "get_btc_price", payment_tx: "0xb", expected: null, bundle_json: '{"v":"x"}', sha: "h2", chain_facts: {}, served_at: 6, labels: {} },
];
const rows = [
  { case_id: "a", tx: "0x1", status: "FINALIZED", result: ["no_refund", "delivered_ok", "deterministic"], stored: { reason: "delivered_ok" }, leader_model: "policy:prd-x", vote_tally: { agree: 3, idle: 2 } },
  { case_id: "a", tx: "0x2", status: "UNDETERMINED", result: null },
  { case_id: "b", tx: "0x3", status: "FINALIZED", result: ["refund", "stale_data", "model"], stored: { reason: "stale_data" }, leader_model: "m" },
  { case_id: "b", tx: "0x4", status: "FINALIZED", result: ["refund", "stale_data", "model"], stored: {}, leader_model: "n" },
];
const inst = { address: "0xI", seller_key: "KEY" };

test("each case carries its bundle, explorer facts and the recorded finalized live runs only", () => {
  const d = slaPageData({ cases, rows, instance: inst });
  assert.equal(d.instance, "0xI");
  assert.equal(d.seller_key, "KEY");
  assert.equal(d.cases.length, 2);
  const a = d.cases[0];
  assert.deepEqual(a.recorded.map((r) => r.tx), ["0x1"]);
  assert.equal(a.bundle_json, '{"v":"iussum-sla/0.1"}');
  assert.equal(a.sha, "h1");
  assert.match(a.payment_url, /explorer\.solana\.com\/tx\/S1$/);
  assert.match(d.cases[1].payment_url, /basescan\.org\/tx\/0xb$/);
  assert.equal(d.cases[1].recorded.length, 2);
});
test("a case with no finalized run is reported, never invented", () => {
  const d = slaPageData({ cases, rows: [], instance: inst });
  assert.deepEqual(d.cases[0].recorded, []);
});
