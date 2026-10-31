// Serve the built frontend and same-origin API locally (no Vite development server).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../frontend/dist",
);
const upstream = new URL(process.env.API_TARGET || "http://127.0.0.1:8081");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".md": "text/markdown; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};
if (!fs.existsSync(path.join(root, "index.html")))
  throw new Error("Run npm --prefix frontend run build first.");
const server = http.createServer((request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "same-origin");
  response.setHeader("X-Frame-Options", "DENY");
  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
  } catch {
    response.writeHead(400).end();
    return;
  }
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    const target = new URL(upstream);
    target.pathname = pathname.slice(4) || "/";
    target.search = new URL(request.url, "http://localhost").search;
    const headers = { ...request.headers, host: upstream.host };
    const proxy = http.request(
      target,
      { method: request.method, headers, timeout: 20000 },
      (res) => {
        response.writeHead(res.statusCode, res.headers);
        res.pipe(response);
      },
    );
    proxy.on("timeout", () => proxy.destroy());
    proxy.on("error", () => {
      if (!response.headersSent)
        response.writeHead(502, {
          "Content-Type": "application/json; charset=utf-8",
        });
      response.end(
        JSON.stringify({ code: 0, msg: "后端服务暂不可用", data: null }),
      );
    });
    request.pipe(proxy);
    return;
  }
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405).end();
    return;
  }
  let file = path.resolve(root, "." + pathname);
  if (file !== root && !file.startsWith(root + path.sep)) {
    response.writeHead(403).end();
    return;
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    if (path.extname(pathname)) {
      response.writeHead(404).end();
      return;
    }
    file = path.join(root, "index.html");
  }
  response.setHeader(
    "Content-Type",
    types[path.extname(file)] || "application/octet-stream",
  );
  response.setHeader(
    "Cache-Control",
    file.endsWith(".html") ? "no-cache" : "public, max-age=3600",
  );
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  fs.createReadStream(file).pipe(response);
});
server.listen(Number(process.env.WEB_PORT || 5180), "127.0.0.1", () =>
  console.log(
    `Built V2 frontend: http://127.0.0.1:${process.env.WEB_PORT || 5180}`,
  ),
);
