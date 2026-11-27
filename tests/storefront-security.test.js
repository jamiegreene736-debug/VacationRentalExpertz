import test from "node:test";
import assert from "node:assert/strict";
import { createCatalogLimiter, publicHttpsUrl, validateSearch, setSecurityHeaders } from "../storefront-security.js";
import catalog from "../api/guesty.js";

test("catalog accepts only the fields used by public search", () => {
  assert.equal(validateSearch(new URLSearchParams({
    guests: "08", checkOut: "2028-03-02", checkIn: "2028-02-29", city: "Kāʻanapali",
  })).toString(), "city=K%C4%81%CA%BBanapali&checkIn=2028-02-29&checkOut=2028-03-02&guests=8");
  for (const query of ["limit=83", "guests=0", "guests=33", "city=Maui&city=Kauai",
    "checkIn=2027-02-29", "checkIn=2028-03-02&checkOut=2028-03-01"]) {
    assert.equal(validateSearch(new URLSearchParams(query)), null);
  }
  assert.equal(validateSearch(new URLSearchParams()).size, 0);
});

test("only public HTTPS destinations are accepted for images and booking links", () => {
  assert.equal(publicHttpsUrl("https://assets.guesty.com/photo.jpg"), "https://assets.guesty.com/photo.jpg");
  assert.equal(publicHttpsUrl("https://book.example.com"), "https://book.example.com/");
  assert.equal(publicHttpsUrl("/relative"), "");
  assert.equal(publicHttpsUrl("http://example.com"), "");
});

test("per-client and total search ceilings recover on the next window", () => {
  let now = 30_000;
  const limit = createCatalogLimiter({ perIp: 2, total: 3, clock: () => now });
  const request = ip => ({ headers: {}, socket: { remoteAddress: ip } });
  assert.equal(limit(request("192.0.2.1")), 0);
  assert.equal(limit(request("192.0.2.1")), 0);
  assert.equal(limit(request("192.0.2.1")), 30);
  assert.equal(limit(request("192.0.2.2")), 0);
  assert.equal(limit(request("192.0.2.3")), 30);
  now = 60_001;
  assert.equal(limit(request("192.0.2.1")), 0);
});

function capture(method, query) {
  const headers = new Map();
  const response = { headers, setHeader: (key, value) => headers.set(key, value),
    end: value => { response.body = JSON.parse(value); } };
  return catalog({ method }, response, new URLSearchParams(query)).then(() => response);
}

test("catalog coalesces matching reads, uses fixed destinations, exposes only the public projection", async t => {
  const original = Object.fromEntries(["GUESTY_OPEN_CLIENT_ID", "GUESTY_OPEN_CLIENT_SECRET", "GUESTY_API_MODE"].map(k => [k, process.env[k]]));
  Object.assign(process.env, { GUESTY_OPEN_CLIENT_ID: "fixture-client", GUESTY_OPEN_CLIENT_SECRET: "fixture-secret", GUESTY_API_MODE: "open" });
  t.after(() => { for (const [k, v] of Object.entries(original)) v === undefined ? delete process.env[k] : process.env[k] = v; });
  const calls = [];
  t.mock.method(globalThis, "fetch", async (input, opts) => {
    calls.push(input);
    assert.equal(opts.redirect, "error");
    const url = new URL(input);
    assert.equal(url.hostname, "open-api.guesty.com");
    if (url.pathname === "/oauth2/token") return Response.json({ access_token: "fixture-token" });
    assert.equal(url.pathname, "/v1/listings");
    if (url.searchParams.get("city") === "Unavailable") {
      return Response.json({ message: "Private provider error fixture" }, { status: 500 });
    }
    return Response.json({ results: [{
      _id: "internal-123", title: "Public stay", prices: { basePrice: 329, monthlyPrice: 4545 },
      address: { city: "Maui", street: "private fixture street" }, pictures: ["https://assets.guesty.com/photo.jpg"],
      bookingUrl: "https://book.example.com/stay", descriptions: { summary: "<b>Ocean view</b>", access: "private fixture access" },
      internalNotes: "private fixture note",
    }] });
  });

  const invalid = await capture("GET", "limit=83");
  assert.equal(invalid.statusCode, 400);
  assert.equal((await capture("POST", "")).statusCode, 405);
  assert.equal(calls.length, 0);
  const [a, b] = await Promise.all([capture("GET", "city=Maui&guests=8"), capture("GET", "guests=8&city=Maui")]);
  assert.equal(a.statusCode, 200);
  assert.deepEqual(a.body, b.body);
  assert.equal(calls.length, 2);
  assert.equal(a.headers.has("Access-Control-Allow-Origin"), false);
  const stay = a.body.collections[0];
  assert.deepEqual(Object.keys(a.body), ["collections"]);
  assert.equal(stay.summary, "Ocean view");
  assert.equal(stay.price, 329);
  assert.equal(stay.photos[0], "https://assets.guesty.com/photo.jpg");
  assert.equal(stay.bookingUrl, "https://book.example.com/stay");
  assert.match(stay.id, /^[a-z0-9_-]{24}$/i);
  assert.doesNotMatch(JSON.stringify(a.body), /internal-123|fixture|seasonalPricing|pricingSource|4545/);
  const failed = await capture("GET", "city=Unavailable");
  assert.equal(failed.statusCode, 503);
  assert.equal(failed.body.message, "Live stays are temporarily unavailable.");
  assert.equal(failed.headers.get("Cache-Control"), "no-store");
});

test("security headers are restrictive and HSTS is scoped to this host", () => {
  const values = new Map();
  setSecurityHeaders({ setHeader: (k, v) => values.set(k, v) }, true);
  assert.equal(values.get("X-Frame-Options"), "DENY");
  assert.equal(values.get("X-Content-Type-Options"), "nosniff");
  assert.match(values.get("Content-Security-Policy"), /script-src 'self'/);
  assert.match(values.get("Content-Security-Policy"), /frame-ancestors 'none'/);
  assert.equal(values.get("Strict-Transport-Security"), "max-age=31536000");
});
