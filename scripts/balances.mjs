import { loadKeys, makeCtx, usdc, solBalance, delegation } from "/Volumes/D/iussum/scripts/demo-lib.mjs";
const keys = await loadKeys(); const ctx = makeCtx();
for (const n of ["principal", "agent", "sellerA", "sellerB", "sellerC", "float"]) {
  const a = keys[n].address;
  let u = "?", s = "?"; try { u = String(await usdc(ctx, a)); } catch (e) { u = "err " + String(e.message).slice(0, 60); }
  try { s = String(await solBalance(ctx, a)); } catch (e) { s = "err"; }
  console.log(n, a, "usdc_raw", u, "lamports", s);
}
console.log("principal delegation", JSON.stringify(await delegation(ctx, keys.principal.address), (_, v) => typeof v === "bigint" ? String(v) : v));
