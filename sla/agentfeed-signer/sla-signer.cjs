// SLA receipt signer for AgentFeed (x402.ochinimus.app). NOT DEPLOYED. Express middleware, OFF unless SLA_SIGN=1.
//
// What it does: on a paid, settled, HTTP 200 answer of one of the SLA tools it adds ONE response header, X-SLA-Receipt,
// base64 JSON of the seller's signed receipt: { v, seller, tx_sig, tool, resource, http_status, served_at, body_sha256, signature }.
// The signature is ed25519 over "iussum-sla/0.1 receipt\n" + canonical JSON of the body fields (the same pattern as the
// iussum seller receipt). The response body, status and every other header are untouched.
//
// What it must never do: change the paid flow. Every failure path (no key, flag off, no settlement, error, exception) falls
// through to the original end() with the answer as it was. It reads the settlement from the PAYMENT-RESPONSE header that
// @x402/express sets before it releases the held response; it never talks to a facilitator or a chain.
//
// CommonJS, because AgentFeed's server.js is CommonJS. Mount it BEFORE the payment layer, so that its wrapped end() is the one
// @x402/express (and lib/x402v1.js) finally call after settling. See sla/SERVER-STEPS.md for the exact line.
const crypto = require("node:crypto");

const HOST = "https://x402.ochinimus.app";
const TOOL_BY_PATH = { "/api/sol-price": "get_sol_price", "/api/btc-price": "get_btc_price", "/api/funding-rate": "get_funding_rate" };
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const PKCS8 = Buffer.from("302e020100300506032b657004220420", "hex");

function b58encode(buf) {
  let n = BigInt("0x" + (buf.length ? buf.toString("hex") : "0")), out = "";
  while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n; }
  let z = 0; while (z < buf.length && buf[z] === 0) z++;
  return "1".repeat(z) + out;
}

// canonical JSON as the court's python `canon` writes it: sorted keys, no spaces, raw UTF-8
function canon(o) {
  if (Array.isArray(o)) return "[" + o.map(canon).join(",") + "]";
  if (o && typeof o === "object") return "{" + Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + canon(o[k])).join(",") + "}";
  return JSON.stringify(o);
}

function slaSigner({ enabled = false, seedHex = "", now = Date.now, tools = TOOL_BY_PATH, host = HOST } = {}) {
  let key = null, pub = null;
  if (enabled && /^[0-9a-f]{64}$/i.test(seedHex || "")) {
    try {
      key = crypto.createPrivateKey({ key: Buffer.concat([PKCS8, Buffer.from(seedHex, "hex")]), format: "der", type: "pkcs8" });
      pub = b58encode(crypto.createPublicKey(key).export({ format: "der", type: "spki" }).subarray(12));
    } catch { key = null; }
  }
  return function slaSignerMiddleware(req, res, next) {
    const tool = key && tools[req.path];
    if (!tool) return next();
    const end = res.end;
    res.end = function (chunk, ...rest) {
      try {
        if (res.statusCode === 200 && chunk !== undefined && typeof chunk !== "function") {
          const h = res.getHeader("payment-response");
          const s = h ? JSON.parse(Buffer.from(String(h), "base64").toString("utf8")) : null;
          if (s && s.success === true && typeof s.transaction === "string" && s.transaction) {
            const text = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), rest[0] && typeof rest[0] === "string" ? rest[0] : "utf8");
            const body = {
              v: "iussum-sla/0.1", seller: pub, tx_sig: s.transaction, tool, resource: host + req.originalUrl, http_status: 200,
              served_at: Math.floor(now() / 1000), body_sha256: crypto.createHash("sha256").update(text).digest("hex"),
            };
            const sig = crypto.sign(null, Buffer.from("iussum-sla/0.1 receipt\n" + canon(body)), key).toString("base64");
            res.setHeader("X-SLA-Receipt", Buffer.from(JSON.stringify({ ...body, signature: sig })).toString("base64"));
          }
        }
      } catch { /* never break the paid response */ }
      return end.call(this, chunk, ...rest);
    };
    next();
  };
}

module.exports = { HOST, TOOL_BY_PATH, b58encode, canon, slaSigner };
