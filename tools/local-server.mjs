import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname.replace(/^\/[A-Za-z]:/, value => value.slice(1)));
// Puerto nuevo para no heredar el Service Worker que pudo quedar asociado a 8765.
const port = Number(process.env.ATLAS_PORT || 8766);
const types = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".mjs":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".svg":"image/svg+xml", ".png":"image/png", ".webp":"image/webp", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".md":"text/markdown; charset=utf-8", ".webmanifest":"application/manifest+json" };
createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url || "/", `http://127.0.0.1:${port}`).pathname);
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = normalize(join(root, requested));
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); return res.end("No encontrado"); }
  res.writeHead(200, { "content-type": types[extname(file).toLowerCase()] || "application/octet-stream", "cache-control":"no-store" });
  createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => console.log(`Atlas local: http://127.0.0.1:${port}/`));
