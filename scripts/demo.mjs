// node scripts/demo.mjs [case id]     One command: judge one recorded live devnet case on studionet and print the stored triple and the explorer link.
// Needs only `npm install` and a studionet key (created in .secrets/ on first run; studionet is gasless). Writes to results/demo-*.json, never to the evidence files.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.ROWS_FILE = path.join(ROOT, "results", "demo-rows.jsonl");
process.env.INSTANCES_FILE = path.join(ROOT, "results", "demo-instances.json");
const { DEMO_CASE, bundleFromCase, formatResult } = await import("./demo-lib.mjs");
const { deploy, judge } = await import("./runner.mjs");
const { client } = await import("./lib.mjs");

const id = process.argv[2] ?? DEMO_CASE;
const file = ["real-receipt", "real"].map((d) => path.join(ROOT, "cases", d, id + ".json")).find((f) => fs.existsSync(f));
if (!file) throw new Error(`unknown case ${id}: see cases/real-receipt and cases/real`);
const k = JSON.parse(fs.readFileSync(file, "utf8"));
console.log(`case ${id}: ${k.note ?? ""}`);
console.log(`Solana devnet payment ${k.payment.tx_sig}\nSolana devnet grant   ${k.grant_tx}`);

const instFile = process.env.INSTANCES_FILE;
const insts = fs.existsSync(instFile) ? JSON.parse(fs.readFileSync(instFile)) : {};
const name = "demo";
let inst = insts[name], redeployed = false;
const { c } = client("studionet");
const pinned = k.seller_pub ?? "";
let alive = false;
if (inst) { try { const cfg = await c.readContract({ address: inst.address, functionName: "config", args: [], jsonSafeReturn: true }); alive = cfg.chain_source === "rpc" && (!pinned || String(cfg.seller_keys).split(",").includes(pinned)); } catch { alive = false; } }
if (!alive) { console.log("deploying the court on studionet (about 40 s) ..."); inst = await deploy(name, "rpc", 65536, pinned); redeployed = true; }
console.log(`court instance ${inst.address} (chain_source=rpc, pinned seller key ${pinned ? pinned.slice(0, 6) + "..." : "none"})`);
console.log("submitting the case; the validators read the payment and the grant from Solana devnet ...");
const row = await judge({ inst: name, caseId: id, bundle: bundleFromCase(k), tag: "demo-" + Date.now().toString(36), expected: k.expected_court ?? k.expect ?? null, setName: "demo", pollMs: 4000 });
if (row.submit_error) throw new Error("submission failed: " + row.submit_error);
console.log("\n" + formatResult({ tx: row.tx, stored: row.stored, expected: k.expected_court ?? k.expect, accepted_ms: row.accepted_ms, final_ms: row.final_ms, redeployed }));
