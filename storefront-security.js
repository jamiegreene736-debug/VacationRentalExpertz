import { isIP } from "node:net";

const headers = {
  "Content-Security-Policy": [
    "default-src 'none'", "script-src 'self'", "style-src 'self'",
    "img-src 'self' https: data:", "font-src 'self'", "connect-src 'self'",
    "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'self'",
  ].join("; "),
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export function setSecurityHeaders(response, production) {
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
  // Do not impose a policy on other subdomains, which are separate applications.
  if (production) response.setHeader("Strict-Transport-Security", "max-age=31536000");
}

export function createCatalogLimiter({ perIp = 45, total = 600, limit = 5000, clock = Date.now } = {}) {
  let window = -1, count = 0;
  const clients = new Map();
  return (request) => {
    const now = clock();
    const minute = Math.floor(now / 60_000);
    if (minute !== window) {
      window = minute;
      count = 0;
      clients.clear();
    }
    const real = request.headers["x-real-ip"];
    // Railway supplies X-Real-IP at its HTTP edge. Other deployments use the
    // socket address, not arbitrary client-supplied forwarding headers.
    const key = process.env.RAILWAY_ENVIRONMENT_ID && typeof real === "string" && isIP(real)
      ? real : request.socket.remoteAddress ?? "unknown";
    const seen = clients.get(key) ?? 0;
    if (count >= total || seen >= perIp || (!clients.has(key) && clients.size >= limit)) {
      return Math.ceil((60_000 - now % 60_000) / 1000);
    }
    clients.set(key, seen + 1);
    count++;
    return 0;
  };
}

const inputFields = new Set(["city", "checkIn", "checkOut", "guests"]);
function validDate(value) {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value + "T");
}

export function validateSearch(input) {
  const values = new Map();
  for (const [name, raw] of input) {
    if (!inputFields.has(name) || values.has(name)) return null;
    const value = raw.trim();
    if (name === "city" && (value.length > 80 || !/^[\p{L}\p{M}\p{N} .,'’ʻ\u2010-\u2015-]*$/u.test(value))) return null;
    if ((name === "checkIn" || name === "checkOut") && value && !validDate(value)) return null;
    if (name === "guests" && value && (!/^\d{1,2}$/.test(value) || Number(value) < 1 || Number(value) > 32)) return null;
    values.set(name, value);
  }
  if (values.get("checkIn") && values.get("checkOut") && values.get("checkIn") >= values.get("checkOut")) return null;
  const result = new URLSearchParams();
  for (const name of inputFields) {
    const value = values.get(name);
    if (value) result.set(name, name === "guests" ? String(Number(value)) : value);
  }
  return result;
}

export function publicHttpsUrl(value) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}
