// Live devnet cases WITH a seller receipt, produced by iussum's own code, read-only: the demo seller gate (observe mode: it never refuses and signs a receipt that
// records what was presented), iussum's agent, and iussum's resolver service for the verdict and verdict_id. The receipt is never touched.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { ROOT } from "./lib.mjs";
import { canon, sha256 } from "./bundle.mjs";
import { loadKeys, makeCtx, sendTx, startDemoSeller, usdc, NETWORK, MINT } from "/Volumes/D/iussum/scripts/demo-lib.mjs";

const req = createRequire("/Volumes/D/iussum/scripts/x.mjs");
const { getApproveCheckedInstruction, TOKEN_PROGRAM_ADDRESS } = req("@solana-program/token");
const { createAgent } = await import(req.resolve("@iussum/agent"));
const { createResolver, openStore } = await import(req.resolve("@iussum/resolver"));
const { principalAta, summaryLine, verifyReceipt, mandateId } = await import(req.resolve("@iussum/core"));

const keys = await loadKeys(); const ctx = makeCtx();
const seller = await startDemoSeller(ctx, { name: "A", signer: keys.sellerA, mode: "observe" });
const sellerPub = (await (await fetch(`${seller.origin}/.well-known/iussum.json`)).json()).seller;
const store = openStore(":memory:");
const service = createResolver({ rpc: ctx.rpc, network: NETWORK, sellerKey: async (payTo) => (payTo === keys.sellerA.address ? sellerPub : null), store, now: () => Math.floor(Date.now() / 1000) }); // no sendRefund: nothing is refunded
const now = () => Math.floor(Date.now() / 1000);

const CASES = [
  { id: "rr-1-seller-overcap", per_payment_max: "5000", purpose: "Buy one price quote from the demo seller (the /v1/quote item). One-off purchase.", expected_court: ["valid", "seller", "amount_over_cap"], note: "the seller (observe mode) settled a 0.01 USDC payment above the 0.005 per-payment cap, receipt records the mandate as presented: liability seller" },
  { id: "rr-2-onpurpose", per_payment_max: "50000", purpose: "Buy one price quote from the demo seller (the /v1/quote item). One-off purchase.", expected_court: ["invalid", "principal", "in_scope"], note: "inside every limit and what was asked for" },
];
for (const c of CASES) {
  const out = path.join(ROOT, "cases/real-receipt", c.id + ".json");
  if (fs.existsSync(out)) { console.log(c.id, "exists"); continue; }
  const t = now();
  const m02 = { v: "iussum/0.2", principal: keys.principal.address, agent: keys.agent.address, network: NETWORK, asset: MINT, total_cap: "100000", per_payment_max: c.per_payment_max, period_budget: "100000", period_seconds: 86400,
    allow: { pay_to: [keys.sellerA.address], resource_prefix: [`${seller.origin}/v1/`] }, not_before: t - 3600, expires_at: t + 7 * 86400, nonce: randomBytes(16).toString("hex") };
  const m03 = { ...m02, v: "iussum/0.3", purpose: c.purpose };
  const id03 = sha256(canon(m03));
  const memo = summaryLine(m02).replace("iussum v0.2", "iussum v0.3").replace(/id [0-9a-f]{64}$/, "id " + id03);
  const src = await principalAta(m02.principal, m02.asset);
  const grant_tx = await sendTx(ctx.rpc, keys.principal, [
    getApproveCheckedInstruction({ source: src, mint: m02.asset, delegate: m02.agent, owner: keys.principal, amount: BigInt(m02.total_cap), decimals: 6 }, { programAddress: TOKEN_PROGRAM_ADDRESS }),
    { programAddress: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", accounts: [], data: new TextEncoder().encode(memo) },
  ]);
  const agent = await createAgent({ mandate: m02, grant_tx, signer: keys.agent, rpc: ctx.rpc, localChecks: false });
  const res = await agent.fetch(seller.url("quote"));
  if (res.status !== 200 || !res.receipt) throw new Error(`${c.id}: payment did not settle (HTTP ${res.status})`);
  const receipt = res.receipt;
  const vr = verifyReceipt(receipt, sellerPub);
  const verdict = await service.dispute({ tx_sig: receipt.tx_sig, mandate: m02, grant_tx, receipt });
  const rec = { id: c.id, note: c.note, mandate: m03, mandate_v02: m02, mandate_v02_id: mandateId(m02), grant_tx, memo,
    payment: { tx_sig: receipt.tx_sig, network: receipt.network, asset: receipt.asset, amount: receipt.amount, pay_to: receipt.pay_to, payer: receipt.payer },
    receipt, seller_pub: sellerPub, receipt_verifies_with_iussum: vr.ok, iussum: { verdict: verdict.verdict, reason: verdict.reason, liable: verdict.liable, verdict_id: verdict.verdict_id, delta: verdict.delta ?? null, time_source: verdict.time_source ?? null },
    expected_court: c.expected_court, made_at: new Date().toISOString() };
  fs.writeFileSync(out, JSON.stringify(rec, null, 1) + "\n");
  console.log(c.id, "grant", grant_tx.slice(0, 10), "pay", receipt.tx_sig.slice(0, 10), "receipt ok", vr.ok, "iussum", verdict.verdict, verdict.reason, verdict.liable);
}
console.log("seller pub", sellerPub, "principal usdc", String(await usdc(ctx, keys.principal.address)));
seller.close(); process.exit(0);
