// node --test tests/connector   (written before scripts/connector-lib.mjs exists)
import test from "node:test";
import assert from "node:assert/strict";
import { nextStep, outcome, NO_CONSENSUS } from "../../scripts/connector-lib.mjs";

const fin = (r) => ({ tx: "0xaa", status: "FINALIZED", result: r });
const und = { tx: "0xbb", status: "UNDETERMINED", result: null };

test("first step is to submit", () => assert.equal(nextStep([]), "submit"));
test("a finalized attempt ends it", () => assert.equal(nextStep([fin(["invalid", "principal", "in_scope"])]), "stop"));
test("one UNDETERMINED attempt is resubmitted once", () => assert.equal(nextStep([und]), "resubmit"));
test("two UNDETERMINED attempts stop: never a third", () => assert.equal(nextStep([und, und]), "stop"));
test("an UNDETERMINED then finalized attempt stops", () => assert.equal(nextStep([und, fin(["valid", "seller", "amount_over_cap"])]), "stop"));

test("outcome of a finalized attempt is the court's own result, source genlayer", () => {
  const o = outcome([fin(["valid", "seller", "amount_over_cap"])]);
  assert.deepEqual([o.source, o.verdict, o.liable, o.reason, o.attempts], ["genlayer", "valid", "seller", "amount_over_cap", 1]);
  assert.deepEqual(o.txs, ["0xaa"]);
});
test("outcome after one UNDETERMINED then a result uses the second and lists both txs", () => {
  const o = outcome([und, fin(["invalid", "principal", "in_scope"])]);
  assert.deepEqual([o.source, o.reason, o.attempts, o.txs], ["genlayer", "in_scope", 2, ["0xbb", "0xaa"]]);
});
test("two UNDETERMINED attempts give could_not_decide/none/no_consensus, source connector, both txs kept", () => {
  const o = outcome([und, { ...und, tx: "0xcc" }]);
  assert.deepEqual([o.source, o.verdict, o.liable, o.reason, o.attempts, o.txs], ["connector", "could_not_decide", "none", "no_consensus", 2, ["0xbb", "0xcc"]]);
  assert.deepEqual(NO_CONSENSUS, ["could_not_decide", "none", "no_consensus"]);
});
test("outcome refuses to answer while an attempt is still open", () => assert.throws(() => outcome([und]), /resubmit/));
test("a submission error is not an UNDETERMINED result and is not turned into one", () => assert.throws(() => outcome([{ tx: null, status: null, result: null, error: "x" }]), /error/));
