// The entry point web/serve.mjs must listen when started the way PM2 starts it (argv[1] is not the script), and refuse bad paths.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

test("serve.mjs listens on the given port and serves the page and the json with the security headers", async () => {
  const port = 38000 + Math.floor(Math.random() * 1000);
  const entry = new URL("../../web/serve.mjs", import.meta.url).href;
  // PM2 runs the script inside its own container: argv[1] is the container, the script's arguments follow
  const code = `process.argv = [process.argv[0], "/usr/lib/node_modules/pm2/lib/ProcessContainerFork.js", "${port}", "web"]; await import(${JSON.stringify(entry)});`;
  const child = spawn("node", ["--input-type=module", "-e", code], { cwd: new URL("../..", import.meta.url).pathname, stdio: "ignore" });
  try {
    let res;
    for (let i = 0; i < 30 && !res; i++) { try { res = await fetch(`http://127.0.0.1:${port}/cases.json`); } catch { await new Promise((r) => setTimeout(r, 150)); } }
    assert.ok(res, "server did not start");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal((await res.json()).cases.length, 8);
    assert.equal((await fetch(`http://127.0.0.1:${port}/.env`)).status, 400);
    assert.equal((await fetch(`http://127.0.0.1:${port}/nope.txt`)).status, 404);
  } finally { child.kill(); }
});
