// node scripts/appeal.mjs <chain> <address>
// Sends one classify, waits ACCEPTED, reads canAppeal + getMinAppealBond, appeals, tracks to FINALIZED.
import { client, sleep, save } from "./lib.mjs";

const [net, address] = process.argv.slice(2);
const { c, account } = client(net);
const out = { net, address, sender: account.address, startedAt: new Date().toISOString(), timeline: [] };
const t0 = Date.now();
const note = (k, v) => out.timeline.push({ ms: Date.now() - t0, k, v });

const hash = await c.writeContract({ address, functionName: "classify", args: ["Water boils at 100 degrees Celsius at sea level."], value: 0n });
out.hash = hash; note("submitted", hash);

async function status() { const tx = await c.getTransaction({ hash }); return { s: tx.statusName ?? String(tx.status), tx }; }
let last = null, tx = null, appealed = false;
while (Date.now() - t0 < 6 * 60_000) {
  let cur;
  try { cur = await status(); } catch { await sleep(3000); continue; }
  tx = cur.tx;
  if (cur.s !== last) { last = cur.s; note("status", cur.s); }
  if (cur.s === "ACCEPTED" && !appealed) {
    appealed = true;
    try { out.canAppeal = await c.canAppeal({ txId: hash }); } catch (e) { out.canAppealErr = String(e?.shortMessage ?? e?.message).slice(0, 300); }
    try { out.minAppealBond = String(await c.getMinAppealBond({ txId: hash })); } catch (e) { out.minAppealBondErr = String(e?.shortMessage ?? e?.message).slice(0, 300); }
    note("pre-appeal", { canAppeal: out.canAppeal, minAppealBond: out.minAppealBond });
    try {
      const r = await c.appealTransaction({ txId: hash, value: out.minAppealBond ? BigInt(out.minAppealBond) : 0n });
      out.appealResult = typeof r === "string" ? r : JSON.stringify(r, (_, v) => (typeof v === "bigint" ? v.toString() : v)).slice(0, 600);
      note("appeal-sent", out.appealResult);
    } catch (e) { out.appealErr = String(e?.shortMessage ?? e?.message).slice(0, 500); note("appeal-error", out.appealErr); }
  }
  if (cur.s === "FINALIZED") break;
  await sleep(2500);
}
const cd = tx?.consensus_data ?? {};
out.finalVotes = cd.votes ?? null;
out.validatorCount = (cd.validators ?? []).length;
out.appealFields = Object.fromEntries(Object.entries(tx ?? {}).filter(([k]) => /appeal|rotation|round|timestamp/i.test(k)));
out.balanceAfter = String(await c.getBalance({ address: account.address }));
save("appeal-studionet.json", out);
console.log(JSON.stringify({ hash, canAppeal: out.canAppeal, minAppealBond: out.minAppealBond ?? out.minAppealBondErr, appeal: out.appealResult ?? out.appealErr, statuses: out.timeline.filter((t) => t.k === "status").map((t) => `${t.v}@${t.ms}`), votes: out.finalVotes && Object.values(out.finalVotes).length, appealFields: out.appealFields }).slice(0, 1500));
