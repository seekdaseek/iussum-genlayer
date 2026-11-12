// Shared helpers for the phase 0 probe. Key is read from .secrets/, never printed.
import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import * as chains from "genlayer-js/chains";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const ROOT = path.resolve(import.meta.dirname, "..");
const KEYFILE = path.join(ROOT, ".secrets", "testnet.key");

export function loadKey() {
  if (!fs.existsSync(KEYFILE)) {
    fs.mkdirSync(path.dirname(KEYFILE), { recursive: true, mode: 0o700 });
    fs.writeFileSync(KEYFILE, generatePrivateKey() + "\n", { mode: 0o600 });
  }
  const k = fs.readFileSync(KEYFILE, "utf8").trim();
  return k;
}

export function keyFingerprint() {
  const k = loadKey();
  return { len: k.length, sha256_8: crypto.createHash("sha256").update(k).digest("hex").slice(0, 8) };
}

export function client(net = "studionet") {
  const chain = chains[net];
  if (!chain) throw new Error("unknown chain " + net);
  const account = createAccount(loadKey());
  return { c: createClient({ chain, account }), account, chain };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Poll our own way so timing does not depend on SDK wait helpers.
// Returns timestamps (ms since submit) of first sighting of each status.
export async function track(c, hash, { until = "FINALIZED", timeoutMs = 45 * 60_000, everyMs = 3000 } = {}) {
  const t0 = Date.now();
  const seen = {};
  let last = null, tx = null, errs = 0;
  while (Date.now() - t0 < timeoutMs) {
    try {
      tx = await c.getTransaction({ hash });
      const s = tx.statusName ?? String(tx.status);
      if (s !== last) { seen[s] = Date.now() - t0; last = s; }
      if (s === until || ["CANCELED", "UNDETERMINED"].includes(s) && until !== "FINALIZED") break;
      if (s === until) break;
    } catch (e) {
      errs++;
      if (errs > 40) throw e;
    }
    await sleep(everyMs);
  }
  return { hash, seen, last, tx, pollErrors: errs, waitedMs: Date.now() - t0 };
}

export function jsonSafe(o) {
  return JSON.parse(JSON.stringify(o, (_, v) => (typeof v === "bigint" ? v.toString() : v instanceof Map ? Object.fromEntries(v) : v)));
}

export function save(name, obj) {
  const p = path.join(ROOT, "results", name);
  fs.writeFileSync(p, JSON.stringify(jsonSafe(obj), null, 2) + "\n");
  return p;
}
