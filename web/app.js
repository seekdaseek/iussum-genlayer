import { canon, sha256Hex, bundleFromCase, newTag, nextStep, outcome, matches, statusLine, explorerTx, solanaTx, pinnedKeyOk } from "./lib.mjs";

const GL = window.GL;
const $ = (id) => document.getElementById(id);
const mem = {};
const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k) ?? mem[k] ?? null; localStorage.setItem(k, v); mem[k] = v; return v; } catch { if (v !== undefined) mem[k] = v; return mem[k] ?? null; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const short = (s, n = 8) => (s && s.length > 2 * n + 1 ? `${s.slice(0, n)}…${s.slice(-n)}` : s);
const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === "text") e.textContent = v; else e.setAttribute(k, v); } for (const kid of kids) e.append(kid); return e; };
const link = (href, text) => el("a", { href, target: "_blank", rel: "noopener", text });

let data, selected = null, client, busy = false;

function account() {
  let pk = store("mandatecourt.pk");
  if (!pk) { pk = GL.generatePrivateKey(); store("mandatecourt.pk", pk); }
  return GL.createAccount(pk);
}

function notice(text) { const n = $("notice"); n.textContent = text; n.hidden = !text; }

function renderPicker() {
  const box = $("picker");
  box.replaceChildren();
  for (const c of data.cases) {
    const b = el("button", { type: "button", class: "case", role: "radio", "aria-checked": "false", "data-id": c.id }, el("strong", { text: c.title }), el("small", { text: c.id }));
    b.addEventListener("click", () => select(c.id));
    box.append(b);
  }
}

function select(id) {
  if (busy) return;
  selected = data.cases.find((c) => c.id === id);
  for (const b of $("picker").children) b.setAttribute("aria-checked", String(b.dataset.id === id));
  const d = $("detail");
  d.hidden = false;
  d.replaceChildren(
    el("p", { text: selected.blurb }),
    el("p", {}, el("strong", { text: "Signed purpose: " }), document.createTextNode(`“${selected.purpose}”`)),
    el("p", {}, document.createTextNode("Solana devnet: "), link(solanaTx(selected.grant_tx), "grant transaction"), document.createTextNode(" · "), link(solanaTx(selected.payment_tx), "payment transaction")),
    el("p", {}, el("strong", { text: "Seller receipt: " }), document.createTextNode(selected.receipt ? `yes, signed by the seller's key ${short(selected.receipt.seller, 6)}` : "none")),
    el("p", {}, el("strong", { text: "Recorded expectation: " }), document.createTextNode(selected.expected.join(" / "))),
  );
  $("judge").disabled = false;
  $("timeline").replaceChildren(); $("result").hidden = true; notice("");
}

function addLine(text, t0, href) {
  const li = el("li", {}, el("span", { class: "t", text: t0 == null ? "" : `${Math.round((Date.now() - t0) / 1000)} s` }), href ? link(href, text) : el("span", { text }));
  $("timeline").append(li);
}

async function ensureInstance(c) {
  let address = store("mandatecourt.instance") ?? data.instance;
  let cfg = null, lastErr = null;
  for (let i = 0; i < 3; i++) {
    try { cfg = await client.readContract({ address, functionName: "config", args: [], jsonSafeReturn: true }); lastErr = null; break; }
    catch (e) { lastErr = e; if (/not found/i.test(String(e?.message ?? e))) break; await sleep(2000); }
  }
  if (lastErr && !/not found/i.test(String(lastErr?.message ?? lastErr))) throw new Error("studionet did not answer: " + String(lastErr?.shortMessage ?? lastErr?.message ?? lastErr).slice(0, 160));
  if (pinnedKeyOk(cfg, c)) return address;
  notice("The shared court instance is not on studionet (its state was reset) or does not pin this seller's key. Redeploying the court first, about 40 seconds.");
  const t0 = Date.now();
  addLine("Deploying the court contract to studionet…", t0);
  const code = await (await fetch("contract/mandate_court.py")).text();
  const hash = await client.deployContract({ code, args: [data.rpc_url, 65536n, "rpc", data.pinned_keys] });
  addLine("Deploy transaction", t0, explorerTx(hash));
  for (let i = 0; i < 90; i++) {
    await sleep(4000);
    try { const tx = await client.getTransaction({ hash }); if (tx.statusName === "FINALIZED") { address = tx.data?.contract_address ?? tx.to_address; break; } } catch { /* keep polling */ }
  }
  store("mandatecourt.instance", address);
  addLine(`Court redeployed at ${short(address, 10)}`, t0);
  notice("");
  return address;
}

async function waitFor(hash, t0, onAccepted) {
  const seen = new Set(); let errs = 0, acceptedDone = false, tx = null;
  for (let i = 0; i < 300; i++) {
    try {
      tx = await client.getTransaction({ hash }); errs = 0;
      const s = tx.statusName;
      if (!seen.has(s)) { seen.add(s); addLine(statusLine(s, (Date.now() - t0) / 1000), null); }
      if (s === "ACCEPTED" && !acceptedDone) { acceptedDone = true; await onAccepted?.(tx); }
      if (["FINALIZED", "UNDETERMINED", "CANCELED"].includes(s)) return tx;
    } catch (e) { if (++errs > 15) throw new Error("lost contact with studionet: " + String(e?.shortMessage ?? e?.message).slice(0, 120)); }
    await sleep(4000);
  }
  throw new Error("timed out waiting for the transaction");
}

async function readStored(address, sha, tag) {
  for (let i = 0; i < 3; i++) {
    try { const s = await client.readContract({ address, functionName: "get_result", args: [`${sha}:${tag}`], jsonSafeReturn: true }); return s ? JSON.parse(s) : null; }
    catch { await sleep(1500); }
  }
  return null;
}

const tally = (tx) => { const t = {}; for (const v of Object.values(tx?.consensus_data?.votes ?? {})) t[v] = (t[v] ?? 0) + 1; return Object.entries(t).map(([k, v]) => `${v} ${k}`).join(", "); };
const leaderModel = (tx) => { const l = tx?.consensus_data?.leader_receipt; const r = Array.isArray(l) ? l[0] : l; return r?.node_config?.primary_model?.model ?? r?.node_config?.model ?? null; };

async function judge() {
  if (!selected || busy) return;
  busy = true; $("judge").disabled = true; $("result").hidden = true; $("timeline").replaceChildren(); notice("");
  const T0 = Date.now();
  try {
    client = client ?? GL.createClient({ chain: GL.studionet, account: account() });
    const bundle = bundleFromCase(selected), json = canon(bundle), sha = await sha256Hex(json);
    const address = await ensureInstance(selected);
    const attempts = []; let lastTx = null;
    while (nextStep(attempts) !== "stop") {
      const tag = newTag(), t0 = Date.now();
      addLine(attempts.length ? "Submitting again (UNDETERMINED the first time) …" : "Submitting the case to the court …", t0);
      const hash = await client.writeContract({ address, functionName: "judge", args: [json, sha, "", tag], value: 0n });
      addLine(`Transaction ${short(hash, 8)} (open in the explorer)`, t0, explorerTx(hash));
      let provisional = null;
      const tx = await waitFor(hash, t0, async () => { provisional = await readStored(address, sha, tag); if (provisional) addLine(`Accepted, not final yet: ${provisional.verdict} / ${provisional.liable} / ${provisional.reason}`, null); });
      lastTx = tx;
      const stored = tx.statusName === "FINALIZED" ? await readStored(address, sha, tag) : null;
      attempts.push({ tx: hash, status: tx.statusName, result: stored ? [stored.verdict, stored.liable, stored.reason] : null, stored, txObj: tx, ms: Date.now() - t0 });
      if (tx.statusName === "UNDETERMINED" && attempts.length === 1) notice("UNDETERMINED: the validators did not agree after three rotations. By the caller-side rule the page resubmits once.");
    }
    notice("");
    render(outcome(attempts), attempts, lastTx, address, Date.now() - T0);
  } catch (e) {
    notice("Something went wrong: " + String(e?.message ?? e).slice(0, 240) + " You can press the button again.");
  } finally { busy = false; $("judge").disabled = false; }
}

function render(o, attempts, tx, address, ms) {
  const last = attempts[attempts.length - 1], stored = last.stored;
  const ok = o.source === "genlayer" && matches({ verdict: o.verdict, liable: o.liable, reason: o.reason }, selected.expected);
  $("triple").replaceChildren(document.createTextNode(`${o.verdict} / ${o.liable} / ${o.reason}`), el("span", { class: "pill " + (o.source === "connector" ? "warn" : ok ? "ok" : "bad"), text: o.source === "connector" ? "no consensus" : ok ? "matches the recorded expectation" : "differs from the recorded expectation" }));
  const rows = [];
  const add = (k, v) => rows.push(el("dt", { text: k }), el("dd", {}, typeof v === "string" ? document.createTextNode(v) : v));
  if (o.source === "connector") add("Note", "Two attempts ended UNDETERMINED. The page records could_not_decide / none / no_consensus next to both transaction ids, as the connector does; the contract itself stored nothing.");
  if (stored) {
    add("Decided by", stored.path === "model" ? "the validators' model jury (one question, closed answer set)" : stored.path === "deterministic" ? "plain code, no model asked" : "a fixed refusal in plain code, no model asked");
    if (stored.delta) add("Delta", el("pre", { text: JSON.stringify(stored.delta, null, 1) }));
    if (stored.reasoning) add("Model's reasoning (stored, not compared)", stored.reasoning);
    add("Chain source", `${stored.chain_source} (the validators read Solana devnet themselves)`);
  }
  add("Recorded expectation", selected.expected.join(" / ") + (selected.earlier_expectation ? ` (before the signed-text fix this case was expected to be ${selected.earlier_expectation.join(" / ")})` : ""));
  const lm = leaderModel(tx), vt = tally(tx);
  if (lm) add("Leader model", lm);
  if (vt) add("Votes", vt + " (idle = the validator was not needed once quorum was reached)");
  add("Time", `${Math.round(ms / 1000)} s from the click to ${last.status}`);
  add("Court contract", address);
  add("GenLayer transactions", el("span", {}, ...attempts.flatMap((a, i) => [i ? document.createTextNode(" · ") : "", link(explorerTx(a.tx), short(a.tx, 10))])));
  $("facts").replaceChildren(...rows);
  $("result").hidden = false;
  $("result").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function main() {
  data = await (await fetch("cases.json")).json();
  renderPicker();
  $("judge").addEventListener("click", judge);
  const q = new URLSearchParams(location.search).get("case");
  if (q && data.cases.some((c) => c.id === q)) select(q);
}
main().catch((e) => notice("Could not load the page data: " + e.message));
