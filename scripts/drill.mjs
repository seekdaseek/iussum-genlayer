// Destructive drill: try to provoke a genuine UNDETERMINED on chain with genuinely ambiguous cases (Set B v2 borderline cases that already drew disagree votes),
// through the connector, so its resubmit-once and no_consensus rules run for real. Time box: 28 minutes. Nothing is faked: a case ends UNDETERMINED only if the network says so.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.mjs";
const cases = ["B2-22-border", "B2-32-border", "B2-33-border", "B2-35-border", "B2-26-border", "B2-21-border", "B2-34-border"];
const deadline = Date.now() + 28 * 60_000; let n = 0;
outer: for (let round = 1; ; round++) for (const id of cases) {
  if (Date.now() > deadline) break outer;
  const r = spawnSync("node", ["scripts/connector.mjs", `cases/b2/${id}.json`, "live4-b"], { cwd: ROOT, encoding: "utf8", timeout: 600000 });
  const f = path.join(ROOT, "results/connector", `${id}.json`);
  if (!fs.existsSync(f)) { console.log(id, "no record", (r.stderr || "").slice(-200)); continue; }
  const j = JSON.parse(fs.readFileSync(f)); n++;
  fs.copyFileSync(f, path.join(ROOT, "results/drill", `${id}-${n}.json`));
  const st = j.genlayer.attempts.map((a) => a.status);
  console.log(new Date().toISOString().slice(11, 19), id, "attempts", st.join(","), "->", j.outcome.verdict + "/" + j.outcome.liable + "/" + j.outcome.reason, j.outcome.source);
  if (st.some((s) => s === "UNDETERMINED")) console.log("   *** an UNDETERMINED happened", j.outcome.txs.join(" "));
}
console.log("drill over, runs:", n);
