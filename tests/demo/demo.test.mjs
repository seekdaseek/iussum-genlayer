// node --test tests/demo   (written before scripts/demo-lib.mjs exists)
import test from "node:test";
import assert from "node:assert/strict";
import { bundleFromCase, explorerLink, formatResult, DEMO_CASE } from "../../scripts/demo-lib.mjs";

const k = { id: "rr-x", mandate: { v: "iussum/0.3" }, grant_tx: "G", payment: { tx_sig: "P" }, receipt: { seller: "S" }, seller_pub: "S", expected_court: ["valid", "seller", "amount_over_cap"] };

test("bundle from a recorded case: schema, grant, payment, receipt, no unsigned delivered text", () => {
  const b = bundleFromCase(k);
  assert.deepEqual(Object.keys(b).sort(), ["delivery", "grant_tx", "mandate", "payment", "v"]);
  assert.equal(b.v, "iussum-genlayer/0.2");
  assert.deepEqual(b.delivery, { receipt: { seller: "S" } });
});
test("a case without a receipt gives an empty delivery", () => assert.deepEqual(bundleFromCase({ ...k, receipt: undefined }).delivery, {}));
test("explorer link points at the studio explorer", () => assert.equal(explorerLink("0xab"), "https://explorer-studio.genlayer.com/tx/0xab"));
test("formatResult prints the stored triple, the expectation and the link, and says when it does not match", () => {
  const out = formatResult({ tx: "0xab", stored: { verdict: "valid", liable: "seller", reason: "amount_over_cap", path: "deterministic", chain_source: "rpc" }, expected: ["valid", "seller", "amount_over_cap"], accepted_ms: 12000, final_ms: 45000, redeployed: true });
  assert.match(out, /valid \/ seller \/ amount_over_cap/);
  assert.match(out, /matches the recorded expectation/);
  assert.match(out, /explorer-studio\.genlayer\.com\/tx\/0xab/);
  assert.match(out, /redeployed/);
  assert.match(formatResult({ tx: "0xab", stored: { verdict: "invalid", liable: "principal", reason: "in_scope", path: "model", chain_source: "rpc" }, expected: ["valid", "seller", "amount_over_cap"] }), /DIFFERS/);
});
test("the default demo case is the seller-liability case", () => assert.equal(DEMO_CASE, "rr-1-seller-overcap"));

test("a case file that already carries a built bundle is used as is (Set B v2 chain cases)", () => {
  const b = { v: "iussum-genlayer/0.2", mandate: {}, grant_tx: "G", payment: {}, delivery: { receipt: { seller: "T" } } };
  assert.deepEqual(bundleFromCase({ id: "B2-x", bundle: b }), b);
});

test("the runner deploys the contract named by CONTRACT_FILE, the shipping contract by default", async () => {
  const { contractPath } = await import("../../scripts/runner.mjs");
  delete process.env.CONTRACT_FILE;
  assert.match(contractPath(), /contracts\/mandate_court\.py$/);
  process.env.CONTRACT_FILE = "/x/controls/mandate_court_single.py";
  assert.equal(contractPath(), "/x/controls/mandate_court_single.py");
  delete process.env.CONTRACT_FILE;
});
