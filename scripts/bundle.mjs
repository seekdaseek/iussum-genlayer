// Builds the iussum-genlayer/0.1 bundle from iussum's recorded case (real devnet payment 5KsYz26T...).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ROOT } from "./lib.mjs";

export function canon(v) {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  return JSON.stringify(v);
}
export const sha256 = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex");

const fx = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures/iussum-resolve-case54.json"), "utf8")).input;

export function makeBundle({ mandateOver = {}, receipt = true, presented = true, instruction, delivered } = {}) {
  const m = { ...structuredClone(fx.mandate), ...mandateOver };
  const mid = sha256(canon(m));
  const payment = { tx_sig: fx.tx_sig, network: m.network, asset: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", amount: "10000", pay_to: "5hQASoTWuCSjSz3GfUmrVDfUKEvRMDLpqUK1wuUi5Gk7", payer: "4ZUJeT13Kqtv9H6G64QLe5a5EUar2L927nBcYavTPmSi" };
  const delivery = {};
  if (receipt) delivery.receipt = { ...structuredClone(fx.receipt), mandate_id: presented ? mid : "0".repeat(64) };
  delivery.delivered = delivered ?? "quote delivered: BTC price feed, 10 calls";
  const bundle = { v: "iussum-genlayer/0.1", instruction: instruction ?? "Buy one 10-call data quote for the BTC price feed from api.example.test.", mandate: m, payment, delivery };
  const json = canon(bundle);
  return { json, sha: sha256(json), bundle };
}
