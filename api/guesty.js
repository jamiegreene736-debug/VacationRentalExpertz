import { createHmac, randomBytes } from "node:crypto";
import { publicHttpsUrl, validateSearch } from "../storefront-security.js";

const BOOKING_BASE_URL = "https://booking.guesty.com/api";
const BOOKING_TOKEN_URL = "https://booking.guesty.com/oauth2/token";
const OPEN_BASE_URL = "https://open-api.guesty.com/v1";
const OPEN_TOKEN_URL = "https://open-api.guesty.com/oauth2/token";

const bookingFields = [
  "_id",
  "id",
  "nickname",
  "title",
  "type",
  "bedrooms",
  "bathrooms",
  "accommodates",
  "amenities",
  "tags",
  "address",
  "pictures",
  "photos",
  "picture",
  "thumbnail",
  "image",
  "url",
  "publicUrl",
  "bookingUrl",
  "booking_url",
  "bookingEngineUrl",
  "directBookingUrl",
  "listingUrl",
  "urls",
  "links",
  "descriptions",
  "publicDescription",
  "description",
  "marketingDescription",
  "nightlyRates",
  "price",
  "prices",
].join(" ");

const tokenCache = new Map();
const catalogCache = new Map();
const pending = new Map();
const cacheTtl = 120_000;
const cacheLimit = 100;
const maxUpstreamRequests = 8;
const localIdSecret = randomBytes(32);

function cleanEnvValue(value) {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", status === 200 ? "private, max-age=30" : "no-store");
  response.end(JSON.stringify(payload));
}

function getGuestyCredentials(mode) {
  const modePrefix = mode === "open" ? "OPEN" : "BOOKING";
  const clientId = cleanEnvValue(
    process.env[`GUESTY_${modePrefix}_CLIENT_ID`] ||
      process.env[`GUESTY_${modePrefix}_ENGINE_CLIENT_ID`] ||
      process.env.GUESTY_CLIENT_ID,
  );
  const clientSecret = cleanEnvValue(
    process.env[`GUESTY_${modePrefix}_CLIENT_SECRET`] ||
      process.env[`GUESTY_${modePrefix}_ENGINE_CLIENT_SECRET`] ||
      process.env.GUESTY_CLIENT_SECRET,
  );

  return { clientId, clientSecret };
}

async function getToken(mode) {
  const now = Date.now();

  const cached = tokenCache.get(mode);
  if (cached && cached.expiresAt - 60_000 > now) return cached.token;

  const { clientId, clientSecret } = getGuestyCredentials(mode);

  if (!clientId || !clientSecret) {
    if (mode === "open") {
      throw new Error(
        "Guesty Open API credentials are missing. Add GUESTY_OPEN_CLIENT_ID and GUESTY_OPEN_CLIENT_SECRET, or use the fallback GUESTY_CLIENT_ID and GUESTY_CLIENT_SECRET.",
      );
    }

    throw new Error(
      "Guesty Booking Engine API credentials are missing. Add GUESTY_BOOKING_CLIENT_ID and GUESTY_BOOKING_CLIENT_SECRET, or use the fallback GUESTY_CLIENT_ID and GUESTY_CLIENT_SECRET.",
    );
  }

  let tokenResponse;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: mode === "open" ? "open-api" : "booking_engine:api",
    client_id: clientId,
    client_secret: clientSecret,
  });

  tokenResponse = await fetch(mode === "open" ? OPEN_TOKEN_URL : BOOKING_TOKEN_URL, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(5_000),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!tokenResponse.ok) {
    await tokenResponse.body?.cancel();
    const error = new Error("Inventory authentication failed.");
    error.isGuestyAuthError = true;
    throw error;
  }

  const payload = await tokenResponse.json();
  if (typeof payload.access_token !== "string" || !payload.access_token) {
    throw new Error("Inventory authentication returned no token.");
  }
  const lifetime = Number(payload.expires_in ?? 3600);
  tokenCache.set(mode, {
    token: payload.access_token,
    expiresAt: now + (Number.isFinite(lifetime) ? Math.min(Math.max(0, lifetime), 86400) : 3600) * 1000,
  });
  return payload.access_token;
}

function setIfPresent(params, key, value) {
  if (value) params.set(key, value);
}

function isEnvEnabled(name, defaultValue = false) {
  const value = cleanEnvValue(process.env[name]).toLowerCase();

  if (!value) return defaultValue;
  return ["1", "true", "yes", "on"].includes(value);
}

function buildGuestyUrl(query, mode) {
  const search = new URLSearchParams();
  const limit = Math.min(Number(query.get("limit") || 50), 100);
  const skip = Number(query.get("skip") || 0);
  const checkIn = query.get("checkIn");
  const checkOut = query.get("checkOut");
  const guests = Number(query.get("guests") || 0);
  const city = query.get("city");

  search.set("limit", String(limit));
  if (skip > 0) search.set("skip", String(skip));
  search.set("fields", bookingFields);

  if (mode === "open") {
    if (isEnvEnabled("GUESTY_REQUIRE_ACTIVE", true)) {
      search.set("active", "true");
    }

    if (isEnvEnabled("GUESTY_REQUIRE_LISTED", false)) {
      search.set("listed", "true");
    }

    search.set("sort", "title");

    if (process.env.GUESTY_VIEW_ID) {
      search.set("viewId", process.env.GUESTY_VIEW_ID);
    }

    if (checkIn && checkOut) {
      search.set(
        "available",
        JSON.stringify({
          checkIn,
          checkOut,
          ...(guests ? { minOccupancy: guests } : {}),
        }),
      );
    }
  }

  setIfPresent(search, "city", city);
  setIfPresent(search, "q", city && mode === "open" ? city : "");
  setIfPresent(search, "country", query.get("country") || (mode === "booking" ? process.env.GUESTY_DEFAULT_COUNTRY : ""));

  if (mode === "booking") {
    setIfPresent(search, "checkIn", checkIn);
    setIfPresent(search, "checkOut", checkOut);
  }

  if (process.env.GUESTY_LISTING_TAG) {
    search.set("tags", process.env.GUESTY_LISTING_TAG);
  }

  if (query.get("minPrice")) {
    search.set("minPrice", query.get("minPrice"));
  }

  if (query.get("maxPrice")) {
    search.set("maxPrice", query.get("maxPrice"));
  }

  const baseUrl = mode === "open" ? `${OPEN_BASE_URL}/listings` : `${BOOKING_BASE_URL}/listings`;
  return `${baseUrl}?${search.toString()}`;
}

function getListingId(listing) {
  return String(listing._id || listing.id || listing.listingId || listing.nickname || listing.title || "");
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getRateNumber(value) {
  if (value == null) return 0;

  if (typeof value === "number" || typeof value === "string") {
    return toNumber(value);
  }

  if (typeof value !== "object") return 0;

  const candidate =
    value.amount ??
    value.rate ??
    value.price ??
    value.nightly ??
    value.nightlyRate ??
    value.basePrice ??
    value.base ??
    value.value ??
    value.min ??
    value.max;

  return getRateNumber(candidate);
}

function getNightlyRateEntries(nightlyRates) {
  if (!nightlyRates) return [];

  if (Array.isArray(nightlyRates)) {
    return nightlyRates
      .map((entry) => {
        if (typeof entry !== "object") {
          return { date: "", price: getRateNumber(entry) };
        }

        return {
          date: entry.date || entry.day || entry.startDate || entry.from || "",
          price: getRateNumber(entry),
        };
      })
      .filter((entry) => entry.price > 0);
  }

  if (typeof nightlyRates !== "object") return [];

  return Object.entries(nightlyRates)
    .map(([date, value]) => ({ date, price: getRateNumber(value) }))
    .filter((entry) => entry.price > 0);
}

function cleanText(value) {
  if (!value) return "";

  if (typeof value === "object") {
    return cleanText(value.summary || value.space || value.description || value.headline);
  }

  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value, maxLength) {
  if (!value || value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).replace(/\s+\S*$/, "")}.`;
}

function getDescriptionSections(listing) {
  const descriptions = listing.descriptions || {};
  const publicDescription = listing.publicDescription || {};
  const publicSummary = typeof publicDescription === "object" ? publicDescription.summary : publicDescription;
  const internalSummary = typeof descriptions === "object" ? descriptions.summary : descriptions;
  const sectionCandidates = [
    ["Overview", publicSummary || internalSummary || listing.description || listing.marketingDescription],
    ["The space", publicDescription.space || descriptions.space],
    ["Neighborhood", publicDescription.neighborhood || descriptions.neighborhood],
    ["House rules", listing.terms?.houseRules || listing.houseRules],
  ];

  return sectionCandidates
    .map(([title, value]) => ({ title, text: cleanText(value) }))
    .filter((section, index, sections) => {
      if (!section.text) return false;
      return sections.findIndex((candidate) => candidate.text === section.text) === index;
    });
}

function getListingText(listing) {
  const sections = getDescriptionSections(listing);
  return sections.map((section) => section.text).join("\n\n");
}

function getPhotoUrl(photo) {
  if (!photo) return "";
  if (typeof photo === "string") return photo;

  return photo.original || photo.regular || photo.url || photo.thumbnail || photo.large || photo.medium || "";
}

function getPhotos(listing) {
  const pictures = listing.pictures || listing.photos || [];
  const galleryPhotos = Array.isArray(pictures) ? pictures.map(getPhotoUrl) : [];
  const singlePhotos = [
    getPhotoUrl(listing.picture),
    listing.thumbnail,
    listing.image,
  ];

  return [...galleryPhotos, ...singlePhotos]
    .map(publicHttpsUrl)
    .filter(Boolean)
    .filter((photo, index, photos) => photos.indexOf(photo) === index);
}

function getBookingUrl(listing) {
  const directUrl =
    listing.bookingUrl ||
    listing.booking_url ||
    listing.bookingEngineUrl ||
    listing.directBookingUrl ||
    listing.publicUrl ||
    listing.listingUrl ||
    listing.url ||
    listing.urls?.booking ||
    listing.urls?.public ||
    listing.links?.booking ||
    listing.links?.public;

  const safeDirectUrl = publicHttpsUrl(directUrl);
  if (safeDirectUrl) return safeDirectUrl;

  const template = cleanEnvValue(process.env.GUESTY_BOOKING_URL_TEMPLATE);
  const listingId = getListingId(listing);

  if (!template || !listingId) return "";

  if (template.includes("{listingId}")) {
    return publicHttpsUrl(template.replaceAll("{listingId}", encodeURIComponent(listingId)));
  }

  try {
    const url = new URL(template);
    url.searchParams.set("listingId", listingId);
    return publicHttpsUrl(url.toString());
  } catch {
    return "";
  }
}

function getPrice(listing) {
  const nightlyRates = getNightlyRateEntries(listing.nightlyRates).map((entry) => entry.price);
  const numericRates = nightlyRates.filter((rate) => Number.isFinite(rate) && rate > 0);

  if (numericRates.length > 0) {
    return Math.round(numericRates.reduce((total, rate) => total + rate, 0) / numericRates.length);
  }

  return getRateNumber(listing.price || listing.prices?.basePrice || listing.prices?.base || listing.prices?.nightly);
}

function getLocation(listing) {
  const address = listing.address || {};
  return [address.city, address.state, address.country].filter(Boolean).join(", ");
}

function normalizeAmenities(amenities) {
  if (!Array.isArray(amenities)) return [];

  return amenities
    .map((amenity) => {
      if (typeof amenity === "string") return amenity;
      return amenity.name || amenity.title || amenity.value || "";
    })
    .filter(Boolean)
    .filter((amenity, index, normalizedAmenities) => normalizedAmenities.indexOf(amenity) === index);
}

function getListingTags(listing) {
  if (!Array.isArray(listing.tags)) return [];

  return listing.tags
    .map((tag) => {
      if (typeof tag === "string") return tag;
      return tag.name || tag.title || "";
    })
    .filter(Boolean);
}

function filterListings(listings) {
  const allowedIds = cleanEnvValue(process.env.GUESTY_LISTING_IDS)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const requiredTag = cleanEnvValue(process.env.GUESTY_LISTING_TAG).toLowerCase();

  return listings.filter((listing) => {
    const idMatches = allowedIds.length === 0 || allowedIds.includes(getListingId(listing));
    const tags = getListingTags(listing).map((tag) => tag.toLowerCase());
    const tagMatches = !requiredTag || tags.includes(requiredTag);

    return idMatches && tagMatches;
  });
}

function normalizeGuestyListing(listing) {
  const bedrooms = toNumber(listing.bedrooms);
  const bathrooms = toNumber(listing.bathrooms);
  const guests = toNumber(listing.accommodates || listing.guests);
  const photos = getPhotos(listing);
  const descriptionSections = getDescriptionSections(listing);
  const text = getListingText(listing);
  const title = listing.title || listing.nickname || "Untitled Guesty listing";
  const image = photos[0] || "";
  const idSecret = process.env.CATALOG_ID_SECRET || getGuestyCredentials("open").clientSecret ||
    getGuestyCredentials("booking").clientSecret || localIdSecret;

  return {
    id: createHmac("sha256", idSecret).update("storefront-collection:v1:").update(getListingId(listing)).digest("base64url").slice(0, 24),
    title,
    resort: listing.address?.city || "",
    location: getLocation(listing),
    badge: bedrooms ? `${bedrooms} bedrooms` : "",
    bedrooms,
    bathrooms,
    guests,
    price: getPrice(listing),
    image,
    photos,
    imageAlt: `${title} vacation rental`,
    summary: truncate(text, 170),
    description: text,
    descriptionSections,
    units: [],
    amenities: normalizeAmenities(listing.amenities),
    bookingUrl: getBookingUrl(listing),
  };
}

function getPayloadListings(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.listings)) return payload.listings;
  if (Array.isArray(payload.data)) return payload.data;

  return [];
}

function getPayloadTotalCount(payload, listings) {
  const totalCount =
    payload?.count ??
    payload?.total ??
    payload?.totalCount ??
    payload?.pagination?.total ??
    payload?.meta?.total ??
    payload?.metadata?.total;

  const normalizedTotalCount = Number(totalCount);

  return Number.isFinite(normalizedTotalCount) && normalizedTotalCount >= listings.length
    ? normalizedTotalCount
    : listings.length;
}

async function fetchGuestyListingsPage(query, mode, token) {
  const guestyUrl = buildGuestyUrl(query, mode);
  const response = await fetch(guestyUrl, {
    redirect: "error",
    signal: AbortSignal.timeout(5_000),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error("Inventory request failed.");
  }

  const listings = getPayloadListings(payload);

  return {
    listings,
    totalCount: getPayloadTotalCount(payload, listings),
  };
}

async function fetchGuestyListings(query, mode, token) {
  const hasExplicitLimit = query.has("limit");
  const requestedLimit = Math.min(Number(query.get("limit") || 100), 100);
  const maxListings = hasExplicitLimit ? requestedLimit : Math.min(Number(process.env.GUESTY_MAX_LISTINGS || 250), 500);
  const listings = [];
  let totalCount = 0;
  let skip = Number(query.get("skip") || 0);

  while (listings.length < maxListings) {
    const pageQuery = new URLSearchParams(query);
    const remainingLimit = Math.max(maxListings - listings.length, 0);
    const pageLimit = Math.min(requestedLimit, remainingLimit);

    if (pageLimit <= 0) break;

    pageQuery.set("limit", String(pageLimit));
    pageQuery.set("skip", String(skip));

    const page = await fetchGuestyListingsPage(pageQuery, mode, token);
    totalCount = Math.max(totalCount, page.totalCount);

    listings.push(...page.listings);

    if (page.listings.length < pageLimit) break;
    if (totalCount && listings.length >= totalCount) break;

    skip += pageLimit;
  }

  return {
    listings,
    totalCount: Math.max(totalCount, listings.length),
  };
}

function getGuestyModes() {
  const requestedMode = cleanEnvValue(process.env.GUESTY_API_MODE || "auto").toLowerCase();

  if (requestedMode === "open") return ["open"];
  if (requestedMode === "booking") return ["booking"];

  return ["open", "booking"];
}

async function loadCatalog(query) {
  for (const mode of getGuestyModes()) {
    let token;
    try {
      token = await getToken(mode);
    } catch (error) {
      if (error.isGuestyAuthError) continue;
      throw error;
    }
    const inventory = await fetchGuestyListings(query, mode, token);
    return { collections: filterListings(inventory.listings).map(normalizeGuestyListing) };
  }
  throw new Error("Inventory provider is unavailable.");
}

export default async function handler(request, response, input) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { message: "Method not allowed" });
  }

  const query = validateSearch(input);
  if (!query) return sendJson(response, 400, { message: "Invalid search parameters." });

  const key = query.toString();
  const hit = catalogCache.get(key);
  if (hit?.until > Date.now()) return sendJson(response, 200, hit.data);

  try {
    let work = pending.get(key);
    if (!work) {
      if (pending.size >= maxUpstreamRequests) {
        response.setHeader("Retry-After", "5");
        return sendJson(response, 503, { message: "Search is busy. Please try again shortly." });
      }
      work = loadCatalog(query).then(data => {
        catalogCache.delete(key);
        if (catalogCache.size >= cacheLimit) catalogCache.delete(catalogCache.keys().next().value);
        catalogCache.set(key, { data, until: Date.now() + cacheTtl });
        return data;
      }).finally(() => pending.delete(key));
      pending.set(key, work);
    }
    return sendJson(response, 200, await work);
  } catch {
    // Never return provider errors, credential configuration, or upstream bodies.
    return sendJson(response, 503, { message: "Live stays are temporarily unavailable.", collections: [] });
  }
}
