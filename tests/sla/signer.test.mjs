import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import sla from "../../sla/agentfeed-signer/sla-signer.cjs";
const { slaSigner, canon, b58encode, TOOL_BY_PATH } = sla;

const SEED = "0b".repeat(32);
const TX = "5i6um8xJKLW76M3ArrBsNXNY4oeHoM9ZT9DhEiLqHyTy9YjyjKXtjBT5X4MRqvL5UYvHLzuhQHxJ9aGcT1RxWkJr";

// a response that behaves like the paid flow: x402 holds the handler's body, sets PAYMENT-RESPONSE, then calls end
function fakeRes() {
  const res = new EventEmitter();
  res.headers = {}; res.statusCode = 200; res.sent = null;
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  res.getHeader = (k) => res.headers[k.toLowerCase()];
  res.end = (chunk) => { res.sent = chunk === undefined ? "" : Buffer.from(chunk).toString("utf8"); return res; };
  return res;
}
const settle = (tx = TX, success = true) => Buffer.from(JSON.stringify({ success, transaction: tx, network: "solana:5eykt", payer: "P" })).toString("base64");
function run(mw, { path = "/api/sol-price", url = path, status = 200, body = '{"tool":"get_sol_price","data":{}}', settleHeader = settle() } = {}) {
  const req = { method: "GET", path, originalUrl: url, headers: {} };
  const res = fakeRes();
  let called = 0;
  mw(req, res, () => { called++; });
  assert.equal(called, 1);
  res.statusCode = status;
  if (settleHeader) res.setHeader("PAYMENT-RESPONSE", settleHeader);
  res.end(body);
  return res;
}
const on = () => slaSigner({ enabled: true, seedHex: SEED, now: () => 1794575119000 });

test("flag off: passthrough, no header, res.end untouched", () => {
  const mw = slaSigner({ enabled: false, seedHex: SEED });
  const req = { path: "/api/sol-price", headers: {} }, res = fakeRes(), end = res.end;
  mw(req, res, () => {});
  assert.equal(res.end, end);
});

test("enabled without a key: passthrough, never throws", () => {
  const mw = slaSigner({ enabled: true, seedHex: "" });
  const res = run(mw);
  assert.equal(res.headers["x-sla-receipt"], undefined);
  assert.equal(res.sent, '{"tool":"get_sol_price","data":{}}');
});

test("body bytes and status are untouched", () => {
  const res = run(on());
  assert.equal(res.sent, '{"tool":"get_sol_price","data":{}}');
  assert.equal(res.statusCode, 200);
});

test("receipt carries the settled tx, the exact resource, the served time and the body digest", () => {
  const res = run(on(), { url: "/api/funding-rate?symbol=ETHUSDT", path: "/api/funding-rate", body: '{"x":1}' });
  const r = JSON.parse(Buffer.from(res.headers["x-sla-receipt"], "base64").toString());
  assert.deepEqual(Object.keys(r).sort(), ["body_sha256", "http_status", "resource", "seller", "served_at", "signature", "tool", "tx_sig", "v"]);
  assert.equal(r.v, "iussum-sla/0.1");
  assert.equal(r.tx_sig, TX);
  assert.equal(r.tool, "get_funding_rate");
  assert.equal(r.resource, "https://x402.ochinimus.app/api/funding-rate?symbol=ETHUSDT");
  assert.equal(r.served_at, 1794575119);
  assert.equal(r.http_status, 200);
  assert.equal(r.body_sha256, crypto.createHash("sha256").update('{"x":1}').digest("hex"));
});

test("signature verifies in node and in the court's own python verifier", () => {
  const res = run(on());
  const r = JSON.parse(Buffer.from(res.headers["x-sla-receipt"], "base64").toString());
  const { signature, ...body } = r;
  const pub = crypto.createPublicKey(crypto.createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(SEED, "hex")]), format: "der", type: "pkcs8" }));
  assert.ok(crypto.verify(null, Buffer.from("iussum-sla/0.1 receipt\n" + canon(body)), pub, Buffer.from(signature, "base64")));
  const py = `
import sys, json, base64
sys.path.insert(0, "sla")
from gen_sla_contract import library
ns = {"hashlib": __import__("hashlib"), "json": json}
exec(library(), ns)
r = json.loads(sys.stdin.read())
sig = base64.b64decode(r.pop("signature"))
pk = ns["b58decode"](r["seller"])
print(ns["ed25519_verify"](pk, ("iussum-sla/0.1 receipt\\n" + ns["canon"](r)).encode(), sig))
`;
  const out = spawnSync("python3", ["-c", py], { input: JSON.stringify(r), cwd: new URL("../..", import.meta.url).pathname, encoding: "utf8" });
  assert.equal(out.stdout.trim(), "True", out.stderr);
});

test("seller key is the b58 of the public key", () => {
  assert.equal(b58encode(Buffer.from([0, 0, 1])), "112");
});

test("no signing without a successful settlement, on errors, or on unknown paths", () => {
  for (const o of [{ settleHeader: null }, { settleHeader: settle(TX, false) }, { status: 500 }, { path: "/api/other", url: "/api/other" }, { status: 402 }]) {
    const res = run(on(), o);
    assert.equal(res.headers["x-sla-receipt"], undefined, JSON.stringify(o));
    assert.equal(res.sent, o.body ?? '{"tool":"get_sol_price","data":{}}');
  }
});

test("a signing failure never breaks the paid response", () => {
  const mw = slaSigner({ enabled: true, seedHex: SEED, now: () => { throw new Error("clock"); } });
  const res = run(mw);
  assert.equal(res.sent, '{"tool":"get_sol_price","data":{}}');
  assert.equal(res.headers["x-sla-receipt"], undefined);
});

test("tool map covers the three SLA tools", () => {
  assert.deepEqual(TOOL_BY_PATH, { "/api/sol-price": "get_sol_price", "/api/btc-price": "get_btc_price", "/api/funding-rate": "get_funding_rate" });
});
