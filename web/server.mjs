// Zero-dependency static server for the MandateCourt page (library). Start it with serve.mjs.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".py": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8" };
export const mimeFor = (f) => MIME[path.extname(f).toLowerCase()] ?? "application/octet-stream";
export function safePath(root, urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath.split("?")[0].split("#")[0]); } catch { return null; }
  if (p.includes("\0") || p.includes("\\")) return null;
  if (p.split("/").some((seg) => seg === ".." || (seg.startsWith(".") && seg.length > 0))) return null;
  if (p === "/" || p === "") p = "/index.html";
  const full = path.join(root, p);
  return full === root || full.startsWith(root + path.sep) ? full : null;
}
const CSP = "default-src 'self'; connect-src 'self' https://studio.genlayer.com; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
export function headersFor(file) {
  const ext = path.extname(file).toLowerCase();
  return { "Content-Type": mimeFor(file), "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Security-Policy": CSP,
    "Cache-Control": [".html", ".json", ".js", ".mjs", ".css", ".py"].includes(ext) ? "no-cache" : "public, max-age=86400" };
}
export function createServer(root) {
  return http.createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, { Allow: "GET, HEAD" }); return res.end(); }
    const file = safePath(root, req.url ?? "/");
    if (!file) { res.writeHead(400); return res.end("bad path"); }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("not found"); }
      res.writeHead(200, { ...headersFor(file), "Content-Length": st.size });
      if (req.method === "HEAD") return res.end();
      fs.createReadStream(file).pipe(res);
    });
  });
}
