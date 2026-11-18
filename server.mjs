import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
const root = process.cwd();
const demo = process.argv.includes("--demo");
const port = demo ? 5174 : 5173;
http
  .createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      if (p === "/") p = "/index.html";
      if (!/^\/(index\.html|(?:js|css|vendor|public)\/[\w./-]+)$/.test(p) || p.includes("..")) {
        res.writeHead(404);
        res.end();
        return;
      }
      const data =
        demo && p === "/js/config.js"
          ? "export const config={url:'',key:'',google:false};"
          : await readFile(path.join(root, p));
      res.writeHead(200, {
        "Content-Type":
          {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".svg": "image/svg+xml",
            ".png": "image/png",
          }[path.extname(p)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("No encontrado");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log("COCO CRM" + (demo ? " · DEMO LOCAL" : "") + ": http://127.0.0.1:" + port),
  );
