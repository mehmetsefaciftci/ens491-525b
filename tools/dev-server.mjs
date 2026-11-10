// Local static server for development (127.0.0.1 only). It also accepts
// PUT /targets/<name>.mind so tools/compile-target.html?save=1 can store a compiled target.
// Usage: node tools/dev-server.mjs [port]
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = normalize(join(import.meta.dirname, ".."));
const port = +(process.argv[2] || 8525);
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".mind": "application/octet-stream" };

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = normalize(join(root, path.endsWith("/") ? path + "index.html" : path));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  if (req.method === "PUT" && /^\/targets\/[\w.-]+\.mind$/.test(path)) {
    const chunks = []; for await (const c of req) chunks.push(c);
    await writeFile(file, Buffer.concat(chunks));
    console.log(`saved ${path} (${Buffer.concat(chunks).length} bytes)`);
    res.writeHead(201).end("saved"); return;
  }
  try { const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream", "cache-control": "no-cache" }).end(body);
  } catch { res.writeHead(404).end("not found"); }
}).listen(port, "127.0.0.1", () => console.log(`http://localhost:${port}`));
