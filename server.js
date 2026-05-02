import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import guestyHandler from "./api/guesty.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");
const port = process.env.PORT || 4173;

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

function safeJoin(baseDir, requestPath) {
  const decodedPath = decodeURIComponent(requestPath);
  const resolvedPath = path.resolve(baseDir, `.${decodedPath}`);

  return resolvedPath.startsWith(baseDir) ? resolvedPath : "";
}

async function serveFile(requestPath, response) {
  const resolvedPath = safeJoin(distDir, requestPath);

  if (!resolvedPath) {
    sendStatus(response, 403, "Forbidden");
    return;
  }

  const extension = path.extname(resolvedPath);
  let filePath = extension ? resolvedPath : path.join(distDir, "index.html");

  try {
    const fileStat = await stat(filePath);

    if (fileStat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    response.statusCode = 200;
    response.setHeader("Content-Type", mimeTypes[path.extname(filePath)] || "application/octet-stream");
    createReadStream(filePath).pipe(response);
  } catch {
    if (extension) {
      sendStatus(response, 404, "Not found");
      return;
    }

    response.statusCode = 200;
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    createReadStream(path.join(distDir, "index.html")).pipe(response);
  }
}

createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (url.pathname === "/api/guesty") {
    guestyHandler(request, response);
    return;
  }

  serveFile(url.pathname, response);
}).listen(port, () => {
  console.log(`VacationRentalExpertz server listening on ${port}`);
});
