// Compile artwork images into a MindAR .mind file from the command line (headless Chrome).
// Needs the dev server running: node tools/dev-server.mjs 8526
// Usage:
//   node tools/compile-targets.mjs artwork.jpg                       -> targets/artwork.mind
//   node tools/compile-targets.mjs a.jpg,b.jpg,c.jpg targets.mind    -> one file, targets in this order
//   node tools/compile-targets.mjs --from content/artworks.json      -> all artworks of a content file,
//                                                                       written to its "targets_mind"
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 8526, DEBUG_PORT = 9333;
let imgs, out;
if (process.argv[2] === "--from") {
  const c = JSON.parse(readFileSync(process.argv[3], "utf8"));
  imgs = c.artworks.map((a) => a.target.replace(/^targets\//, ""));
  out = (c.targets_mind || "targets/targets.mind").replace(/^targets\//, "");
  if (c.artworks.length === 1) out = imgs[0].replace(/\.\w+$/, ".mind");
} else { imgs = (process.argv[2] || "").split(",").filter(Boolean); out = process.argv[3] || imgs[0]?.replace(/\.\w+$/, ".mind"); }
if (!imgs?.length) { console.error("usage: node tools/compile-targets.mjs a.jpg[,b.jpg...] [out.mind] | --from content/x.json"); process.exit(1); }

const chrome = [process.env.CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => p && existsSync(p));
if (!chrome) throw new Error("Chrome not found; set CHROME=/path/to/chrome");
const proc = spawn(chrome, ["--headless=new", `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "mindar-"))}`,
  "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let ws;
  for (let i = 0; i < 50 && !ws; i++) { try { ws = (await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch { await sleep(200); } }
  const sock = new WebSocket(ws); await new Promise((r) => (sock.onopen = r));
  let id = 0; const pending = new Map();
  sock.onmessage = (m) => { const d = JSON.parse(m.data); if (pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } };
  const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); sock.send(JSON.stringify({ id, method, params })); });
  const url = `http://localhost:${PORT}/tools/compile-target.html?imgs=${encodeURIComponent(imgs.join(","))}&out=${encodeURIComponent(out)}&save=1`;
  await send("Page.navigate", { url });
  const t0 = Date.now(); let status = "";
  while (Date.now() - t0 < 20 * 60 * 1000) {
    await sleep(2000);
    status = (await send("Runtime.evaluate", { expression: "document.querySelector('#status')?.textContent || ''", returnByValue: true }))?.result?.value || "";
    process.stdout.write(`\r${status.padEnd(60)}`);
    if (status.startsWith("done") || status.includes("failed")) break;
  }
  console.log(`\n${status.includes("saved") ? "ok" : "check the output"} (${((Date.now() - t0) / 1000).toFixed(0)} s): targets/${out} from ${imgs.join(", ")}`);
  sock.close();
} finally { proc.kill(); }
