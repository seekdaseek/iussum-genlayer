// the /sla page is served by the same static server: directory index and a redirect from /sla to /sla/ (written before the change)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { safePath, createServer } from "../../web/server.mjs";

const root = path.resolve("/srv/web");
test("a path ending in / resolves to that directory's index.html", () => {
  assert.equal(safePath(root, "/sla/"), path.join(root, "sla/index.html"));
  assert.equal(safePath(root, "/sla/?case=x"), path.join(root, "sla/index.html"));
  assert.equal(safePath(root, "/"), path.join(root, "index.html"));
});
test("traversal under /sla/ is still refused", () => {
  for (const p of ["/sla/../x", "/sla/%2e%2e/x", "/sla/.env"]) assert.equal(safePath(root, p), null, p);
});

async function withServer(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "slasrv-"));
  fs.mkdirSync(path.join(dir, "sla"));
  fs.writeFileSync(path.join(dir, "index.html"), "ROOT");
  fs.writeFileSync(path.join(dir, "sla/index.html"), "SLA");
  fs.writeFileSync(path.join(dir, "sla/x.json"), "{}");
  const s = createServer(dir);
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  try { await fn(`http://127.0.0.1:${s.address().port}`); } finally { s.close(); fs.rmSync(dir, { recursive: true, force: true }); }
}
test("/sla redirects to /sla/ keeping the query; /sla/ serves the page", async () => {
  await withServer(async (b) => {
    const r = await fetch(b + "/sla?case=a", { redirect: "manual" });
    assert.equal(r.status, 301);
    assert.equal(r.headers.get("location"), "/sla/?case=a");
    const p = await fetch(b + "/sla/");
    assert.equal(p.status, 200);
    assert.equal(await p.text(), "SLA");
    assert.equal(await (await fetch(b + "/")).text(), "ROOT");
    assert.equal((await fetch(b + "/sla/x.json")).status, 200);
    assert.equal((await fetch(b + "/nope")).status, 404);
    assert.equal((await fetch(b + "/sla/missing.html")).status, 404);
  });
});
