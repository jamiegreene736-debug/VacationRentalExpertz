import { open, realpath } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import catalogHandler from "./api/guesty.js";
import { createCatalogLimiter, setSecurityHeaders } from "./storefront-security.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");
const port = process.env.PORT || 4173;
const apexHost = "vacationrentalexpertz.com";
const wwwHost = "www.vacationrentalexpertz.com";
const catalogLimit = createCatalogLimiter();

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function sendStatus(response, status, message) {
  response.statusCode = status;
  response.setHeader("Content-Type", "text/plain; charset=utf-8");
  response.end(message);
}

function contained(base, file) {
  const relative = path.relative(base, file);
  return relative !== "" && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}

async function serveFile(requestPath, request, response) {
  let decoded;
  try { decoded = decodeURIComponent(requestPath); }
  catch { return sendStatus(response, 400, "Bad request"); }

  if (/[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.split("/").some(segment => segment.startsWith("."))) {
    return sendStatus(response, 404, "Not found");
  }

  const resolved = path.resolve(distDir, "." + decoded);
  const extension = path.extname(resolved);
  const candidate = extension ? resolved : path.join(distDir, "index.html");
  if (!contained(distDir, candidate)) return sendStatus(response, 404, "Not found");

  let file;
  try {
    const [root, canonical] = await Promise.all([realpath(distDir), realpath(candidate)]);
    if (!contained(root, canonical)) return sendStatus(response, 404, "Not found");
    file = await open(canonical, "r");
    const info = await file.stat();
    if (!info.isFile()) return sendStatus(response, 404, "Not found");
    response.statusCode = 200;
    response.setHeader("Content-Type", mimeTypes[path.extname(candidate)] || "application/octet-stream");
    response.setHeader("Content-Length", info.size);
    response.setHeader("Cache-Control", candidate.endsWith(".html") ? "no-cache" : "public, max-age=300");
    if (request.method === "HEAD") return response.end();
    await pipeline(file.createReadStream(), response);
  } catch {
    if (!response.headersSent && !response.destroyed) return sendStatus(response, extension ? 404 : 503, extension ? "Not found" : "Temporarily unavailable");
  } finally {
    if (file) await file.close().catch(() => {});
  }
}

const server = createServer({ requestTimeout: 15_000, headersTimeout: 10_000, maxHeaderSize: 16_384 }, async (request, response) => {
  const host = request.headers.host?.split(":")[0]?.toLowerCase();
  setSecurityHeaders(response, host === wwwHost || host === apexHost);
  try {
    const raw = request.url || "";
    if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.length > 2048) {
      return sendStatus(response, 400, "Bad request");
    }
    const url = new URL(raw, "http://localhost");
    if (host === apexHost) {
      response.statusCode = 301;
      response.setHeader("Location", `https://${wwwHost}${url.pathname}${url.search}`);
      return response.end();
    }
    if (url.pathname === "/api/stays") {
      const retry = catalogLimit(request);
      if (retry) {
        response.setHeader("Retry-After", String(retry));
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.statusCode = 429;
        return response.end(JSON.stringify({ message: "Too many requests. Please try again shortly." }));
      }
      return await catalogHandler(request, response, url.searchParams);
    }
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return sendStatus(response, 404, "Not found");
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.setHeader("Allow", "GET, HEAD");
      return sendStatus(response, 405, "Method not allowed");
    }
    await serveFile(url.pathname, request, response);
  } catch {
    if (!response.headersSent && !response.destroyed) sendStatus(response, 500, "Temporarily unavailable");
  }
});

server.listen(port, () => console.log(`VacationRentalExpertz server listening on ${port}`));
