// node --test tests/web   (written before web/server.mjs exists)
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { safePath, mimeFor, headersFor } from "../../web/server.mjs";

const root = path.resolve("/srv/web");
test("normal paths resolve inside the root; / is index.html", () => {
  assert.equal(safePath(root, "/"), path.join(root, "index.html"));
  assert.equal(safePath(root, "/app.js?x=1"), path.join(root, "app.js"));
  assert.equal(safePath(root, "/vendor/genlayer.js"), path.join(root, "vendor/genlayer.js"));
});
test("traversal, encoded traversal, null bytes, dotfiles and backslashes are refused", () => {
  for (const p of ["/../etc/passwd", "/%2e%2e/etc/passwd", "/a/../../x", "/%00", "/.env", "/vendor/.git/config", "/a\\b", "/%5c..%5cx"]) assert.equal(safePath(root, p), null, p);
});
test("a malformed percent escape is refused, not thrown", () => assert.equal(safePath(root, "/%E0%A4%A"), null));
test("mime types: the contract copy is plain text, scripts and json are typed", () => {
  assert.equal(mimeFor("a.html"), "text/html; charset=utf-8");
  assert.equal(mimeFor("a.mjs"), "text/javascript; charset=utf-8");
  assert.equal(mimeFor("a.png"), "image/png");
  assert.equal(mimeFor("mandate_court.py"), "text/plain; charset=utf-8");
  assert.equal(mimeFor("x.unknown"), "application/octet-stream");
});
test("headers: nosniff, a CSP that allows only this origin plus the studionet RPC, no-cache for html and json", () => {
  const h = headersFor("index.html");
  assert.equal(h["X-Content-Type-Options"], "nosniff");
  assert.match(h["Content-Security-Policy"], /default-src 'self'/);
  assert.match(h["Content-Security-Policy"], /connect-src 'self' https:\/\/studio\.genlayer\.com/);
  assert.equal(h["Cache-Control"], "no-cache");
  assert.equal(headersFor("cases.json")["Cache-Control"], "no-cache");
  assert.match(headersFor("logo.png")["Cache-Control"], /max-age/);
});
