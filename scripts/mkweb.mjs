// Builds web/cases.json (the 8 recorded live cases + the pinned seller keys) and copies the contract the page can redeploy. Public data only.
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.mjs";
const J = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const LABELS = {
  "real-1-onpurpose-quote": ["On purpose, no receipt", "A one-off price quote bought as asked. With no seller receipt the court has only the signed purpose and the chain facts, so the shipping contract answers could_not_decide."],
  "real-2-onpurpose-weather": ["On purpose (weather pass), no receipt", "A 30-day weather API pass bought as asked. No seller receipt: the shipping contract answers could_not_decide."],
  "real-3-offpurpose-subscription": ["Off purpose (subscription), no receipt", "The principal asked for a one-off purchase, never a subscription. With no seller receipt the court cannot see what was delivered and answers could_not_decide (before the signed-text fix it said purpose_mismatch from unsigned text)."],
  "real-4-offpurpose-quantity": ["Off purpose (quantity), no receipt", "The principal asked for exactly 3 ETH quotes. No seller receipt: could_not_decide (before the signed-text fix: purpose_mismatch)."],
  "real-5-scope-overcap": ["Over the per-payment cap", "Paid 0.01 USDC against a 0.005 cap. Decided in plain code; no receipt, so liability goes to the agent operator."],
  "real-6-scope-wrongpayto": ["Paid a seller outside the mandate", "The payee is not in the signed allow-list. Decided in plain code."],
  "rr-1-seller-overcap": ["Over the cap, signed seller receipt", "The seller's gate settled a payment above the cap and signed a receipt that records the mandate as presented: liability falls on the seller."],
  "rr-2-onpurpose": ["On purpose, signed seller receipt", "Inside every limit and what was asked for, with a receipt from iussum's seller gate. Goes through the 5-model jury."],
};
// Cases real-1 to real-4 have no signed seller receipt. Their first expectation (in_scope / purpose_mismatch) came from unsigned delivery text that the shipping contract no longer reads; the shipping contract's recorded answer for them is could_not_decide (REPORT-phase4.md, section 2).
const NO_RECEIPT_RECORDED = ["could_not_decide", "none", "insufficient_evidence"];
const out = [];
for (const [dir, ids] of [["cases/real", ["real-1-onpurpose-quote", "real-2-onpurpose-weather", "real-3-offpurpose-subscription", "real-4-offpurpose-quantity", "real-5-scope-overcap", "real-6-scope-wrongpayto"]], ["cases/real-receipt", ["rr-1-seller-overcap", "rr-2-onpurpose"]]]) {
  for (const id of ids) {
    const k = J(`${dir}/${id}.json`);
    out.push({ id, title: LABELS[id][0], blurb: LABELS[id][1], purpose: k.mandate.purpose, grant_tx: k.grant_tx, payment_tx: k.payment?.tx_sig ?? k.payment_tx,
      mandate: k.mandate, payment: k.payment ?? { tx_sig: k.payment_tx }, receipt: k.receipt ?? null, expected: ["real-1-onpurpose-quote", "real-2-onpurpose-weather", "real-3-offpurpose-subscription", "real-4-offpurpose-quantity"].includes(id) ? NO_RECEIPT_RECORDED : (k.expected_court ?? k.expect), earlier_expectation: ["real-1-onpurpose-quote", "real-2-onpurpose-weather", "real-3-offpurpose-subscription", "real-4-offpurpose-quantity"].includes(id) ? (k.expect ?? null) : null });
  }
}
const pinned = [fs.readFileSync(path.join(ROOT, "sets/test-seller.pub"), "utf8").trim(), J("cases/real-receipt/rr-1-seller-overcap.json").seller_pub].join(",");
fs.writeFileSync(path.join(ROOT, "web/cases.json"), JSON.stringify({ instance: "0xc33059A88dFD4602d0D0cc2403Cf5C3a94Dc0B5e", pinned_keys: pinned, rpc_url: "https://api.devnet.solana.com", cases: out }));
fs.copyFileSync(path.join(ROOT, "contracts/mandate_court.py"), path.join(ROOT, "web/contract/mandate_court.py"));
console.log(out.length, "cases; pinned keys", pinned.split(",").length);
