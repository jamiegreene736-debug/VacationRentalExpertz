const BOOKING_BASE_URL = "https://booking.guesty.com/api";
const BOOKING_TOKEN_URL = "https://booking.guesty.com/oauth2/token";
const OPEN_BASE_URL = "https://open-api.guesty.com/v1";
const OPEN_TOKEN_URL = "https://open-api.guesty.com/oauth2/token";

const fallbackImage =
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=82";

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
  "picture",
  "thumbnail",
  "descriptions",
  "publicDescription",
  "description",
  "nightlyRates",
  "prices",
].join(" ");

let tokenCache = {
  mode: "",
  token: "",
  expiresAt: 0,
};

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", status === 200 ? "s-maxage=300, stale-while-revalidate=900" : "no-store");
  response.end(JSON.stringify(payload));
}

function getQuery(request) {
  const host = request.headers.host || "localhost";
  return new URL(request.url, `https://${host}`).searchParams;
}

async function getToken(mode) {
  const now = Date.now();

  if (tokenCache.mode === mode && tokenCache.token && tokenCache.expiresAt - 60_000 > now) {
    return tokenCache.token;
  }

  const clientId = process.env.GUESTY_CLIENT_ID;
  const clientSecret = process.env.GUESTY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Guesty credentials are missing. Add GUESTY_CLIENT_ID and GUESTY_CLIENT_SECRET.");
  }

  let tokenResponse;

  if (mode === "open") {
    tokenResponse = await fetch(OPEN_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, clientSecret }),
    });
  } else {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      scope: "booking_engine:api",
      client_id: clientId,
      client_secret: clientSecret,
    });

    tokenResponse = await fetch(BOOKING_TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
  }

  const payload = await tokenResponse.json().catch(() => ({}));

  if (!tokenResponse.ok) {
    throw new Error(payload.message || "Guesty authentication failed.");
  }

  tokenCache = {
    mode,
    token: payload.access_token,
    expiresAt: now + Math.min(Number(payload.expires_in || 86400), 86400) * 1000,
  };

  return tokenCache.token;
}

function setIfPresent(params, key, value) {
  if (value) params.set(key, value);
}

function buildGuestyUrl(query, mode) {
  const search = new URLSearchParams();
  const limit = Math.min(Number(query.get("limit") || 50), 100);

  search.set("limit", String(limit));

  if (mode === "open") {
    search.set("active", "true");
    search.set("isListed", "true");
  } else {
    search.set("fields", bookingFields);
  }

  setIfPresent(search, "city", query.get("city"));
  setIfPresent(search, "country", query.get("country") || process.env.GUESTY_DEFAULT_COUNTRY);
  setIfPresent(search, "checkIn", query.get("checkIn"));
  setIfPresent(search, "checkOut", query.get("checkOut"));

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

function getListingText(listing) {
  return (
    cleanText(listing.publicDescription?.summary) ||
    cleanText(listing.publicDescription) ||
    cleanText(listing.descriptions?.summary) ||
    cleanText(listing.descriptions?.space) ||
    cleanText(listing.description) ||
    cleanText(listing.marketingDescription) ||
    ""
  );
}

function getImage(listing) {
  const pictures = listing.pictures || listing.photos || [];
  const firstPicture = Array.isArray(pictures) ? pictures[0] : null;

  return (
    firstPicture?.original ||
    firstPicture?.url ||
    firstPicture?.thumbnail ||
    listing.picture?.original ||
    listing.picture?.url ||
    listing.thumbnail ||
    listing.image ||
    fallbackImage
  );
}

function getPrice(listing) {
  const nightlyRates = Object.values(listing.nightlyRates || {}).map(Number);
  const numericRates = nightlyRates.filter((rate) => Number.isFinite(rate) && rate > 0);

  if (numericRates.length > 0) {
    return Math.round(numericRates.reduce((total, rate) => total + rate, 0) / numericRates.length);
  }

  return toNumber(listing.price || listing.prices?.basePrice || listing.prices?.base || listing.prices?.nightly);
}

function getLocation(listing) {
  const address = listing.address || {};
  return [address.city, address.state, address.country].filter(Boolean).join(", ") || "Beach destination";
}

function normalizeAmenities(amenities) {
  if (!Array.isArray(amenities)) return [];

  return amenities
    .map((amenity) => {
      if (typeof amenity === "string") return amenity;
      return amenity.name || amenity.title || amenity.value || "";
    })
    .filter(Boolean)
    .slice(0, 8);
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
  const allowedIds = (process.env.GUESTY_LISTING_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const requiredTag = (process.env.GUESTY_LISTING_TAG || "").trim().toLowerCase();

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
  const text = getListingText(listing);
  const title = listing.title || listing.nickname || "Guesty combined beach stay";

  return {
    id: getListingId(listing),
    title,
    resort: listing.address?.city || listing.nickname || "VacationRentalExpertz",
    location: getLocation(listing),
    badge: bedrooms ? `${bedrooms}BR combined listing` : "Guesty combined listing",
    bedrooms,
    bathrooms,
    guests,
    price: getPrice(listing),
    image: getImage(listing),
    imageAlt: `${title} vacation rental`,
    summary:
      truncate(text, 170) ||
      "A Guesty-managed combined listing for beach groups that want togetherness, value, and wind-down separation.",
    description:
      text ||
      "This stay is maintained in Guesty as one combined, guest-facing listing. The listing description should explain the two-place setup, proximity, and wind-down benefits for guests.",
    units: [
      {
        name: "Combined Guesty listing",
        detail: `${bedrooms || "Multiple"} bedrooms, ${bathrooms || "multiple"} baths, sleeps ${
          guests || "your group"
        }.`,
      },
      {
        name: "Guest-facing setup",
        detail: "The two-place structure, proximity, and wind-down separation are described directly in Guesty.",
      },
    ],
    amenities: normalizeAmenities(listing.amenities),
    guestyListingId: getListingId(listing),
  };
}

async function fetchGuestyListings(query, mode, token) {
  const guestyUrl = buildGuestyUrl(query, mode);
  const response = await fetch(guestyUrl, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || payload.error || "Guesty listings request failed.");
  }

  return Array.isArray(payload.results) ? payload.results : payload.listings || [];
}

export default async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", process.env.GUESTY_ALLOWED_ORIGIN || "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, { message: "Method not allowed" });
    return;
  }

  try {
    const mode = process.env.GUESTY_API_MODE === "open" ? "open" : "booking";
    const query = getQuery(request);
    const token = await getToken(mode);
    const listings = filterListings(await fetchGuestyListings(query, mode, token));
    const collections = listings.map(normalizeGuestyListing);

    sendJson(response, 200, {
      source: "guesty",
      collections,
      rawCount: listings.length,
      syncedAt: new Date().toISOString(),
      message: collections.length > 0 ? "" : "Guesty returned no combined listings for this search.",
    });
  } catch (error) {
    sendJson(response, 500, {
      source: "demo",
      collections: [],
      message: error.message || "Guesty inventory could not be loaded.",
    });
  }
}
