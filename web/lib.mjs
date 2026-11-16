// Pure logic of the MandateCourt page. No Node imports: runs unchanged in the browser. Tested in tests/web/lib.test.mjs.
export function canon(v) {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  return JSON.stringify(v);
}
export async function sha256Hex(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const bundleFromCase = (k) => k.bundle ?? ({ v: "iussum-genlayer/0.2", mandate: k.mandate, grant_tx: k.grant_tx, payment: k.payment, delivery: k.receipt ? { receipt: k.receipt } : {} });
export function newTag() {
  const r = crypto.getRandomValues(new Uint8Array(4));
  return ("web-" + Date.now().toString(36) + [...r].map((b) => b.toString(36)).join("")).slice(0, 32);
}
// The caller-side rule, identical to scripts/connector-lib.mjs: UNDETERMINED is resubmitted once; twice gives could_not_decide/none/no_consensus.
export const NO_CONSENSUS = ["could_not_decide", "none", "no_consensus"];
const und = (a) => a.status === "UNDETERMINED";
export function nextStep(attempts) {
  if (attempts.length === 0) return "submit";
  if (und(attempts[attempts.length - 1]) && attempts.length === 1) return "resubmit";
  return "stop";
}
export function outcome(attempts) {
  if (nextStep(attempts) === "resubmit") throw new Error("one UNDETERMINED attempt: resubmit once before asking for an outcome");
  if (nextStep(attempts) === "submit") throw new Error("no attempt yet");
  const last = attempts[attempts.length - 1], txs = attempts.map((a) => a.tx);
  if (last.error) throw new Error("submission error is not an outcome: " + last.error);
  if (und(last)) { const [verdict, liable, reason] = NO_CONSENSUS; return { source: "connector", verdict, liable, reason, attempts: attempts.length, txs }; }
  if (!last.result) throw new Error("finalized attempt without a stored result");
  const [verdict, liable, reason] = last.result;
  return { source: "genlayer", verdict, liable, reason, attempts: attempts.length, txs };
}
export const matches = (stored, expected) => Boolean(stored && expected && stored.verdict === expected[0] && stored.liable === expected[1] && stored.reason === expected[2]);
export const statusLine = (status, seconds) => `${status} · ${Math.round(seconds)} s`;
export const explorerTx = (h) => `https://explorer-studio.genlayer.com/tx/${h}`;
export const solanaTx = (s) => `https://explorer.solana.com/tx/${s}?cluster=devnet`;
// an instance can judge a case only if it reads devnet itself (rpc) and pins the key that signed the case's receipt
export function pinnedKeyOk(cfg, c) {
  if (!cfg || cfg.chain_source !== "rpc") return false;
  const seller = c.receipt?.seller ?? c.bundle?.delivery?.receipt?.seller;
  return !seller || String(cfg.seller_keys ?? "").split(",").includes(seller);
}
