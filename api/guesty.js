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

let tokenCache = {
  mode: "",
  token: "",
  expiresAt: 0,
};

function cleanEnvValue(value) {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function createGuestyAuthError(mode, status, detail) {
  const apiName = mode === "open" ? "Open API" : "Booking Engine API";
  const error = new Error(
    `Guesty authentication failed for ${apiName}${status ? ` (HTTP ${status})` : ""}.${
      detail ? ` Guesty said: ${detail}` : ""
    }`,
  );

  error.isGuestyAuthError = true;
  error.mode = mode;

  return error;
}

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

  const clientId = cleanEnvValue(process.env.GUESTY_CLIENT_ID);
  const clientSecret = cleanEnvValue(process.env.GUESTY_CLIENT_SECRET);

  if (!clientId || !clientSecret) {
    throw new Error("Guesty credentials are missing. Add GUESTY_CLIENT_ID and GUESTY_CLIENT_SECRET.");
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
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const rawPayload = await tokenResponse.text();
  let payload = {};

  try {
    payload = rawPayload ? JSON.parse(rawPayload) : {};
  } catch {
    payload = {};
  }

  if (!tokenResponse.ok) {
    const detail = payload.error_description || payload.error || payload.message || rawPayload.slice(0, 180);
    throw createGuestyAuthError(mode, tokenResponse.status, detail);
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
  const checkIn = query.get("checkIn");
  const checkOut = query.get("checkOut");
  const guests = Number(query.get("guests") || 0);
  const city = query.get("city");

  search.set("limit", String(limit));
  search.set("fields", bookingFields);

  if (mode === "open") {
    search.set("active", "true");
    search.set("listed", "true");
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
    ["Guest access", publicDescription.access || descriptions.access],
    ["Neighborhood", publicDescription.neighborhood || descriptions.neighborhood],
    ["Notes", publicDescription.notes || descriptions.notes],
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

  if (directUrl) return directUrl;

  const template = cleanEnvValue(process.env.GUESTY_BOOKING_URL_TEMPLATE);
  const listingId = getListingId(listing);

  if (!template || !listingId) return "";

  if (template.includes("{listingId}")) {
    return template.replaceAll("{listingId}", encodeURIComponent(listingId));
  }

  try {
    const url = new URL(template);
    url.searchParams.set("listingId", listingId);
    return url.toString();
  } catch {
    return "";
  }
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

  return {
    id: getListingId(listing),
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

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.listings)) return payload.listings;
  if (Array.isArray(payload.data)) return payload.data;

  return [];
}

function getGuestyModes() {
  const requestedMode = cleanEnvValue(process.env.GUESTY_API_MODE || "auto").toLowerCase();

  if (requestedMode === "open") return ["open"];
  if (requestedMode === "booking") return ["booking"];

  return ["open", "booking"];
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

  const query = getQuery(request);
  const authErrors = [];

  try {
    for (const mode of getGuestyModes()) {
      let token;

      try {
        token = await getToken(mode);
      } catch (error) {
        if (error.isGuestyAuthError) {
          authErrors.push(error.message);
          continue;
        }

        throw error;
      }

      const fetchedListings = await fetchGuestyListings(query, mode, token);
      const listings = filterListings(fetchedListings);
      const collections = listings.map(normalizeGuestyListing);

      sendJson(response, 200, {
        source: "guesty",
        mode,
        collections,
        rawCount: fetchedListings.length,
        filteredCount: listings.length,
        syncedAt: new Date().toISOString(),
        message:
          collections.length > 0
            ? ""
            : "Guesty returned zero listings for this search/configuration. Check listing filters, Booking Engine inclusion, or Guesty view/tag settings.",
      });
      return;
    }

    throw new Error(
      [
        "Guesty authentication failed for every configured API mode.",
        "If your credentials came from Guesty Open API, set GUESTY_API_MODE=open.",
        "If they came from the Booking Engine API screen, set GUESTY_API_MODE=booking.",
        ...authErrors,
      ].join(" "),
    );
  } catch (error) {
    sendJson(response, 500, {
      source: "guesty",
      collections: [],
      message: error.message || "Guesty inventory could not be loaded.",
    });
  }
}
