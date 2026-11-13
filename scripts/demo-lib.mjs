export const DEMO_CASE = "rr-1-seller-overcap";
export const explorerLink = (tx) => `https://explorer-studio.genlayer.com/tx/${tx}`;
export const bundleFromCase = (k) => ({ v: "iussum-genlayer/0.2", mandate: k.mandate, grant_tx: k.grant_tx, payment: k.payment, delivery: k.receipt ? { receipt: k.receipt } : {} });
export function formatResult({ tx, stored, expected, accepted_ms, final_ms, redeployed }) {
  const got = stored ? [stored.verdict, stored.liable, stored.reason] : null;
  const same = got && expected && JSON.stringify(got) === JSON.stringify(expected);
  const lines = [];
  if (redeployed) lines.push("note: no live instance found on studionet (state reset or first run): redeployed the court first");
  lines.push(`court result : ${got ? got.join(" / ") : "none stored"}   (path: ${stored?.path ?? "?"}, chain_source: ${stored?.chain_source ?? "?"})`);
  if (stored?.delta) lines.push(`delta        : ${JSON.stringify(stored.delta)}`);
  if (expected) lines.push(`recorded expectation: ${expected.join(" / ")}  ->  ${same ? "matches the recorded expectation" : "DIFFERS from the recorded expectation"}`);
  if (accepted_ms) lines.push(`time         : accepted ${(accepted_ms / 1000).toFixed(1)} s, finalized ${final_ms ? (final_ms / 1000).toFixed(1) + " s" : "not reached"}`);
  lines.push(`GenLayer tx  : ${tx}`);
  lines.push(`explorer     : ${explorerLink(tx)}`);
  return lines.join("\n");
}
