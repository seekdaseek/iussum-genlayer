// node --test tests/web   (written before web/lib.mjs exists)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { canon as nodeCanon, sha256 as nodeSha } from "../../scripts/bundle.mjs";
import * as conn from "../../scripts/connector-lib.mjs";
import { bundleFromCase as nodeBundle } from "../../scripts/demo-lib.mjs";
import { canon, sha256Hex, bundleFromCase, newTag, nextStep, outcome, matches, statusLine, explorerTx, solanaTx, pinnedKeyOk } from "../../web/lib.mjs";

const rr1 = JSON.parse(fs.readFileSync("cases/real-receipt/rr-1-seller-overcap.json", "utf8"));

test("canon equals the repo's canonical JSON (sorted keys, no spaces, nested arrays)", () => {
  const v = { b: [3, { y: 1, x: "é" }], a: null, c: "z" };
  assert.equal(canon(v), nodeCanon(v));
  assert.equal(canon(v), '{"a":null,"b":[3,{"x":"é","y":1}],"c":"z"}');
});
test("sha256Hex of the real bundle equals the hash the Node runner computes", async () => {
  const b = nodeBundle(rr1);
  assert.equal(await sha256Hex(canon(b)), nodeSha(nodeCanon(b)));
});
test("bundleFromCase equals the demo's bundle for a receipt case and a no-receipt case", () => {
  assert.deepEqual(bundleFromCase(rr1), nodeBundle(rr1));
  const noRc = { ...rr1, receipt: null };
  assert.deepEqual(bundleFromCase(noRc), nodeBundle(noRc));
  assert.deepEqual(bundleFromCase(noRc).delivery, {});
});
test("newTag is a valid run tag: 1 to 32 chars of letters, digits, dash, underscore, and different each call", () => {
  const a = newTag(), b = newTag();
  assert.match(a, /^[A-Za-z0-9_-]{1,32}$/);
  assert.notEqual(a, b);
});
test("the UNDETERMINED rule behaves exactly like scripts/connector-lib.mjs", () => {
  const fin = { tx: "0xaa", status: "FINALIZED", result: ["valid", "seller", "amount_over_cap"] };
  const und = { tx: "0xbb", status: "UNDETERMINED", result: null };
  for (const a of [[], [fin], [und], [und, und], [und, fin]]) {
    assert.equal(nextStep(a), conn.nextStep(a));
    if (conn.nextStep(a) === "stop") assert.deepEqual(outcome(a), conn.outcome(a));
  }
  assert.deepEqual(outcome([und, { ...und, tx: "0xcc" }]).reason, "no_consensus");
});
test("matches compares the stored triple with the recorded expectation", () => {
  assert.equal(matches({ verdict: "valid", liable: "seller", reason: "amount_over_cap" }, ["valid", "seller", "amount_over_cap"]), true);
  assert.equal(matches({ verdict: "invalid", liable: "principal", reason: "in_scope" }, ["valid", "seller", "amount_over_cap"]), false);
  assert.equal(matches(null, ["a", "b", "c"]), false);
});
test("statusLine shows the stage, the elapsed seconds and nothing about unknown statuses being fine", () => {
  assert.match(statusLine("PROPOSING", 12.4), /PROPOSING/);
  assert.match(statusLine("PROPOSING", 12.4), /12 s/);
  assert.match(statusLine("FINALIZED", 45.2), /45 s/);
});
test("links", () => {
  assert.equal(explorerTx("0xab"), "https://explorer-studio.genlayer.com/tx/0xab");
  assert.equal(solanaTx("SIG"), "https://explorer.solana.com/tx/SIG?cluster=devnet");
});
test("an instance is usable for a case only if it is rpc mode and pins the receipt's seller key", () => {
  const cfg = { chain_source: "rpc", seller_keys: "AAA,BBB" };
  assert.equal(pinnedKeyOk(cfg, { receipt: { seller: "BBB" } }), true);
  assert.equal(pinnedKeyOk(cfg, { receipt: { seller: "CCC" } }), false);
  assert.equal(pinnedKeyOk(cfg, { receipt: null }), true);
  assert.equal(pinnedKeyOk({ ...cfg, chain_source: "bundle" }, { receipt: null }), false);
  assert.equal(pinnedKeyOk(null, { receipt: null }), false);
});
