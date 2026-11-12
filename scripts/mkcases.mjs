// Real devnet cases: v0.3 grant (ApproveChecked + Memo ending in the v0.3 mandate id) and a delegate payment, using iussum's own
// helpers read-only from /Volumes/D/iussum. Saves mandate body, grant tx, payment tx, delivery text and the expectation.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { ROOT } from "./lib.mjs";
import { canon, sha256 } from "./bundle.mjs";
import { loadKeys, makeCtx, sendTx, sendDelegateTransfer, usdc, NETWORK, MINT } from "/Volumes/D/iussum/scripts/demo-lib.mjs";

const req = createRequire("/Volumes/D/iussum/scripts/x.mjs");
const { getApproveCheckedInstruction, TOKEN_PROGRAM_ADDRESS } = req("@solana-program/token");
const { principalAta, summaryLine } = await import(req.resolve("@iussum/core"));

const keys = await loadKeys(); const ctx = makeCtx();
const only = process.argv[2];
const A = keys.sellerA.address, B = keys.sellerB.address, C = keys.sellerC.address;
const now = () => Math.floor(Date.now() / 1000);

const CASES = [
  { id: "real-1-onpurpose-quote", pay_to: A, amount: "10000", over: {}, purpose: "Buy one 10-call data quote for the BTC price feed from api.example.test. One-off purchase only.", delivered: "Delivered: one 10-call BTC price feed quote, one-off, no renewal.", expect: ["invalid", "principal", "in_scope"] },
  { id: "real-2-onpurpose-weather", pay_to: B, amount: "20000", over: {}, purpose: "Pay once for 30 days of access to the weather API at weather.example.test. No auto-renewal.", delivered: "Delivered: one access key for the weather API valid 30 days, paid once, no auto-renewal.", expect: ["invalid", "principal", "in_scope"] },
  { id: "real-3-offpurpose-subscription", pay_to: A, amount: "10000", over: {}, purpose: "Buy one 10-call data quote for the BTC price feed from api.example.test. One-off purchase only, never a subscription.", delivered: "Delivered: subscription started, BTC price feed monthly plan, renews automatically every 30 days until cancelled.", expect: ["valid", "agent_operator", "purpose_mismatch"] },
  { id: "real-4-offpurpose-quantity", pay_to: B, amount: "20000", over: {}, purpose: "Buy exactly 3 ETH price quotes from the quote shop.", delivered: "Delivered: bulk pack of 10,000 SOL price quotes.", expect: ["valid", "agent_operator", "purpose_mismatch"] },
  { id: "real-5-scope-overcap", pay_to: A, amount: "10000", over: { per_payment_max: "5000" }, purpose: "Buy one 10-call data quote for the BTC price feed from api.example.test.", delivered: "Delivered: one 10-call BTC price feed quote.", expect: ["valid", "agent_operator", "amount_over_cap"] },
  { id: "real-6-scope-wrongpayto", pay_to: C, amount: "10000", over: {}, purpose: "Buy one 10-call data quote for the BTC price feed from api.example.test.", delivered: "Delivered: one 10-call BTC price feed quote.", expect: ["valid", "agent_operator", "pay_to_not_allowed"] },
];

for (const c of CASES) {
  if (only && c.id !== only) continue;
  const out = path.join(ROOT, "cases/real", c.id + ".json");
  if (fs.existsSync(out)) { console.log(c.id, "exists, skipped"); continue; }
  const t = now();
  const m03 = { v: "iussum/0.3", purpose: c.purpose, principal: keys.principal.address, agent: keys.agent.address, network: NETWORK, asset: MINT, total_cap: "100000", per_payment_max: "50000", period_budget: "100000", period_seconds: 86400,
    allow: { pay_to: [A, B], resource_prefix: ["https://api.example.test/v1/"] }, not_before: t - 3600, expires_at: t + 7 * 86400, nonce: randomBytes(16).toString("hex"), ...c.over };
  const id03 = sha256(canon(m03));
  const { purpose, ...rest } = m03; const m02 = { ...rest, v: "iussum/0.2" };
  const memo = summaryLine(m02).replace("iussum v0.2", "iussum v0.3").replace(/id [0-9a-f]{64}$/, "id " + id03);
  const src = await principalAta(m03.principal, m03.asset);
  const grant_tx = await sendTx(ctx.rpc, keys.principal, [
    getApproveCheckedInstruction({ source: src, mint: m03.asset, delegate: m03.agent, owner: keys.principal, amount: BigInt(m03.total_cap), decimals: 6 }, { programAddress: TOKEN_PROGRAM_ADDRESS }),
    { programAddress: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", accounts: [], data: new TextEncoder().encode(memo) },
  ]);
  const r = await sendDelegateTransfer(ctx, keys, { to: c.pay_to, amount: c.amount });
  if (r.err) throw new Error(c.id + " payment failed on chain: " + JSON.stringify(r.err));
  const rec = { id: c.id, mandate: m03, mandate_id: id03, memo, grant_tx, payment_tx: r.sig, payment: { tx_sig: r.sig, network: NETWORK, asset: MINT, amount: c.amount, pay_to: c.pay_to, payer: keys.agent.address }, delivered: c.delivered, expect: c.expect, made_at: new Date().toISOString() };
  fs.writeFileSync(out, JSON.stringify(rec, null, 2) + "\n");
  console.log(c.id, "grant", grant_tx.slice(0, 12), "pay", r.sig.slice(0, 12));
  await new Promise((r) => setTimeout(r, 2500));
}
console.log("principal usdc raw after:", String(await usdc(ctx, keys.principal.address)));
