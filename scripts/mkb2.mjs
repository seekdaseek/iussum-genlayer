// Set B v2 chain cases: a real devnet grant (v0.3 memo) and a real delegate payment per case, receipt signed by the pinned TEST seller key (not iussum's gate).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import crypto, { randomBytes } from "node:crypto";
import { ROOT } from "./lib.mjs";
import { canon, sha256 } from "./bundle.mjs";
import { B2, BASE } from "./b2-cases.mjs";
import { loadKeys, makeCtx, sendTx, sendDelegateTransfer, usdc, NETWORK, MINT } from "/Volumes/D/iussum/scripts/demo-lib.mjs";

const req = createRequire("/Volumes/D/iussum/scripts/x.mjs");
const { getApproveCheckedInstruction, TOKEN_PROGRAM_ADDRESS } = req("@solana-program/token");
const { principalAta, summaryLine } = await import(req.resolve("@iussum/core"));
const PKCS8 = Buffer.from("302e020100300506032b657004220420", "hex");
const priv = crypto.createPrivateKey({ key: Buffer.concat([PKCS8, Buffer.from(fs.readFileSync(path.join(ROOT, ".secrets/test-seller.seed"), "utf8").trim(), "hex")]), format: "der", type: "pkcs8" });
const TEST_PUB = fs.readFileSync(path.join(ROOT, "sets/test-seller.pub"), "utf8").trim();
const sign = (b) => ({ ...b, signature: crypto.sign(null, Buffer.from("iussum/0.2 receipt\n" + canon(b), "utf8"), priv).toString("base64") });
const keys = await loadKeys(); const ctx = makeCtx();
const A = keys.sellerA.address, B = keys.sellerB.address;
const now = () => Math.floor(Date.now() / 1000);
const v02id = (m) => { const { purpose: _p, ...r } = m; return sha256(canon({ ...r, v: "iussum/0.2" })); };
const only = process.argv.slice(2);
for (const [id, cls, purpose, res, expected] of B2) {
  if (only.length && !only.includes(id)) continue;
  const out = path.join(ROOT, "cases/b2", id + ".json");
  if (fs.existsSync(out)) continue;
  const t = now();
  const m03 = { v: "iussum/0.3", purpose, principal: keys.principal.address, agent: keys.agent.address, network: NETWORK, asset: MINT, total_cap: "100000", per_payment_max: "50000", period_budget: "100000", period_seconds: 86400, allow: { pay_to: [A, B], resource_prefix: [BASE] }, not_before: t - 3600, expires_at: t + 7 * 86400, nonce: randomBytes(16).toString("hex") };
  const id03 = sha256(canon(m03)); const { purpose: _p, ...rest } = m03;
  const memo = summaryLine({ ...rest, v: "iussum/0.2" }).replace("iussum v0.2", "iussum v0.3").replace(/id [0-9a-f]{64}$/, "id " + id03);
  const src = await principalAta(m03.principal, m03.asset);
  const grant_tx = await sendTx(ctx.rpc, keys.principal, [
    getApproveCheckedInstruction({ source: src, mint: m03.asset, delegate: m03.agent, owner: keys.principal, amount: BigInt(m03.total_cap), decimals: 6 }, { programAddress: TOKEN_PROGRAM_ADDRESS }),
    { programAddress: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", accounts: [], data: new TextEncoder().encode(memo) }]);
  const r = await sendDelegateTransfer(ctx, keys, { to: A, amount: "10000" });
  if (r.err) throw new Error(id + " payment failed " + JSON.stringify(r.err));
  const receipt = sign({ v: "iussum/0.2", mandate_id: v02id(m03), grant_tx, offer_hash: randomBytes(32).toString("hex"), resource: BASE + res, pay_to: A, asset: MINT, network: NETWORK, amount: "10000", payer: keys.agent.address, tx_sig: r.sig, settled_at: now(), seller: TEST_PUB });
  const payment = { tx_sig: r.sig, network: NETWORK, asset: MINT, amount: "10000", pay_to: A, payer: keys.agent.address };
  const bundle = { v: "iussum-genlayer/0.2", mandate: m03, grant_tx, payment, delivery: { receipt } };
  fs.writeFileSync(out, JSON.stringify({ id, class: cls, expected, grant_tx, payment_tx: r.sig, bundle }) + "\n");
  console.log(id, grant_tx.slice(0, 8), r.sig.slice(0, 8));
  await new Promise((x) => setTimeout(x, 1500));
}
console.log("principal usdc raw", String(await usdc(ctx, keys.principal.address)));
