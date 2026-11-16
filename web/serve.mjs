// Entry point: node serve.mjs [port] [root]   (port 3044, root = this folder). Does not depend on argv[1], so it also works under PM2's container.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "./server.mjs";
const args = process.argv.slice(2).filter((a) => a !== "--input-type=module");
const port = Number(args[0] ?? 3044), root = path.resolve(args[1] ?? path.dirname(fileURLToPath(import.meta.url)));
createServer(root).listen(port, "127.0.0.1", () => console.log(`mandatecourt static on 127.0.0.1:${port} serving ${root}`));
