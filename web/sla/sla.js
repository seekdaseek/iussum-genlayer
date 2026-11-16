import { canon, sha256Hex, newTag, statusLine, explorerTx, modelLabel } from "../lib.mjs?v=a7a89775f3";

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
  let pk = store("slacourt.pk");
  if (!pk) { pk = GL.generatePrivateKey(); store("slacourt.pk", pk); }
  return GL.createAccount(pk);
}
const notice = (text) => { const n = $("notice"); n.textContent = text; n.hidden = !text; };
const outcomeText = (r) => (r ? r.slice(0, 2).join(" / ") : "none");

function renderPicker() {
  const box = $("picker");
  box.replaceChildren();
  for (const c of data.cases) {
    const b = el("button", { type: "button", class: "case", role: "radio", "aria-checked": "false", "data-id": c.id }, el("strong", { text: c.title }), el("small", { text: `${c.network} · ${c.tool}` }));
    b.addEventListener("click", () => select(c.id));
    box.append(b);
  }
}

function select(id) {
  if (busy) return;
  selected = data.cases.find((c) => c.id === id);
  for (const b of $("picker").children) b.setAttribute("aria-checked", String(b.dataset.id === id));
  const f = selected.chain_facts, d = $("detail");
  d.hidden = false;
  d.replaceChildren(
    el("p", {}, el("strong", { text: "Payment: " }), document.createTextNode(`${Number(f.amount) / 1e6} USDC on ${selected.network} to the AgentFeed treasury `), link(selected.payment_url, "(open the transaction)")),
    el("p", {}, el("strong", { text: "Tool: " }), document.createTextNode(selected.tool)),
    el("p", {}, el("strong", { text: "Expected ruling: " }), document.createTextNode(selected.expected ? selected.expected.join(" / ") : "decided by the model jury, no fixed expectation")),
    el("p", { class: "muted" }, document.createTextNode(`${selected.labels.receipt}. ${selected.labels.body}.`)),
    el("p", {}, el("strong", { text: "Recorded live runs: " }), ...(selected.recorded.length ? selected.recorded.flatMap((r, i) => [i ? document.createTextNode(" · ") : "", link(explorerTx(r.tx), `${short(r.tx, 6)} ${outcomeText(r.result)}`)]) : [document.createTextNode("none")])),
  );
  $("judge").disabled = false;
  $("timeline").replaceChildren(); $("result").hidden = true; notice("");
}

function addLine(text, t0, href) {
  $("timeline").append(el("li", {}, el("span", { class: "t", text: t0 == null ? "" : `${Math.round((Date.now() - t0) / 1000)} s` }), href ? link(href, text) : el("span", { text })));
}

async function ensureInstance() {
  let address = store("slacourt.instance") ?? data.instance, cfg = null, lastErr = null;
  for (let i = 0; i < 3; i++) {
    try { cfg = await client.readContract({ address, functionName: "config", args: [], jsonSafeReturn: true }); lastErr = null; break; }
    catch (e) { lastErr = e; if (/not found/i.test(String(e?.message ?? e))) break; await sleep(2000); }
  }
  if (lastErr && !/not found/i.test(String(lastErr?.message ?? lastErr))) throw new Error("studionet did not answer: " + String(lastErr?.shortMessage ?? lastErr?.message ?? lastErr).slice(0, 160));
  if (cfg && cfg.seller_key === data.seller_key) return address;
  notice("The shared court instance is not on studionet (its state was reset) or pins another key. Redeploying the court first, about 40 seconds.");
  const t0 = Date.now();
  addLine("Deploying the court contract to studionet…", t0);
  const code = await (await fetch("contract/sla_court.py")).text();
  const args = [data.rpc_solana, data.rpc_base, data.status_url, 65536n, data.seller_key, data.pay_to_solana, data.pay_to_base];
  const hash = await client.deployContract({ code, args });
  addLine("Deploy transaction", t0, explorerTx(hash));
  for (let i = 0; i < 90; i++) {
    await sleep(4000);
    try { const tx = await client.getTransaction({ hash }); if (tx.statusName === "FINALIZED") { address = tx.data?.contract_address ?? tx.to_address; break; } } catch { /* keep polling */ }
  }
  store("slacourt.instance", address);
  addLine(`Court redeployed at ${short(address, 10)}`, t0);
  notice("");
  return address;
}

async function waitFor(hash, t0) {
  const seen = new Set(); let errs = 0, tx = null;
  for (let i = 0; i < 300; i++) {
    try {
      tx = await client.getTransaction({ hash }); errs = 0;
      const s = tx.statusName;
      if (!seen.has(s)) { seen.add(s); addLine(statusLine(s, (Date.now() - t0) / 1000), null); }
      if (["FINALIZED", "UNDETERMINED", "CANCELED"].includes(s)) return tx;
    } catch (e) { if (++errs > 15) throw new Error("lost contact with studionet: " + String(e?.shortMessage ?? e?.message).slice(0, 120)); }
    await sleep(4000);
  }
  throw new Error("timed out waiting for the transaction");
}

const tally = (tx) => { const t = {}; for (const v of Object.values(tx?.consensus_data?.votes ?? {})) t[v] = (t[v] ?? 0) + 1; return Object.entries(t).map(([k, v]) => `${v} ${k}`).join(", "); };
const leaderModel = (tx) => { const l = tx?.consensus_data?.leader_receipt; const r = Array.isArray(l) ? l[0] : l; return modelLabel(r?.node_config?.primary_model?.model ?? r?.node_config?.model ?? null); };

async function judge() {
  if (!selected || busy) return;
  busy = true; $("judge").disabled = true; $("result").hidden = true; $("timeline").replaceChildren(); notice("");
  const T0 = Date.now();
  try {
    client = client ?? GL.createClient({ chain: GL.studionet, account: account() });
    const json = selected.bundle_json, sha = await sha256Hex(json);
    if (sha !== selected.sha || canon(JSON.parse(json)) !== json) throw new Error("the bundle in this page does not match its recorded hash");
    const address = await ensureInstance();
    const tag = newTag(), t0 = Date.now();
    addLine("Submitting the case to the court …", t0);
    const hash = await client.writeContract({ address, functionName: "judge", args: [json, sha, tag], value: 0n });
    addLine(`Transaction ${short(hash, 8)} (open in the explorer)`, t0, explorerTx(hash));
    const tx = await waitFor(hash, t0);
    let stored = null;
    if (tx.statusName === "FINALIZED") for (let i = 0; i < 3 && !stored; i++) { try { const s = await client.readContract({ address, functionName: "get_result", args: [`${sha}:${tag}`], jsonSafeReturn: true }); stored = s ? JSON.parse(s) : null; } catch { await sleep(1500); } }
    render(stored, tx, hash, address, Date.now() - T0);
  } catch (e) {
    notice("Something went wrong: " + String(e?.message ?? e).slice(0, 240) + " You can press the button again.");
  } finally { busy = false; $("judge").disabled = false; }
}

function render(stored, tx, hash, address, ms) {
  const exp = selected.expected, got = stored ? [stored.verdict, stored.reason, stored.path] : null;
  const ok = exp && got ? exp.join() === got.join() : null;
  $("triple").replaceChildren(document.createTextNode(stored ? `${stored.verdict} / ${stored.reason}` : `no stored result (${tx.statusName})`),
    el("span", { class: "pill " + (ok === null ? "warn" : ok ? "ok" : "bad"), text: ok === null ? (stored ? "no fixed expectation for this case" : "no consensus") : ok ? "matches the recorded expectation" : "differs from the recorded expectation" }));
  const rows = [];
  const add = (k, v) => rows.push(el("dt", { text: k }), el("dd", {}, typeof v === "string" ? document.createTextNode(v) : v));
  if (stored) {
    add("Decided by", stored.path === "model" ? "the validators' model jury (one question, closed answer set)" : stored.path === "deterministic" ? "plain code, no model asked" : `plain code ended the case: ${stored.refusal}`);
    if (stored.facts) add("Facts the court used", el("pre", { text: JSON.stringify(stored.facts, null, 1) }));
    if (stored.reasoning) add("Model's reasoning (stored, not compared)", stored.reasoning);
  }
  add("Recorded expectation", exp ? exp.join(" / ") : "none (model case)");
  const lm = leaderModel(tx), vt = tally(tx);
  if (lm) add("Leader model", lm);
  if (vt) add("Votes", vt + " (idle = the validator was not needed once quorum was reached)");
  add("Time", `${Math.round(ms / 1000)} s from the click to ${tx.statusName}`);
  add("Court contract", address);
  add("GenLayer transaction", link(explorerTx(hash), short(hash, 12)));
  $("facts").replaceChildren(...rows);
  $("result").hidden = false;
  $("result").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function main() {
  data = await (await fetch("cases.json?v=a7a89775f3")).json();
  renderPicker();
  $("judge").addEventListener("click", judge);
  const q = new URLSearchParams(location.search).get("case");
  if (q && data.cases.some((c) => c.id === q)) select(q);
}
main().catch((e) => notice("Could not load the page data: " + e.message));
