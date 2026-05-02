const BOOKING_BASE_URL = "https://booking.guesty.com/api";
const BOOKING_TOKEN_URL = "https://booking.guesty.com/oauth2/token";
const OPEN_BASE_URL = "https://open-api.guesty.com/v1";
const OPEN_TOKEN_URL = "https://open-api.guesty.com/oauth2/token";

const bookingFields = [
  "_id",
  "nickname",
  "title",
  "type",
  "bedrooms",
  "bathrooms",
  "accommodates",
  "amenities",
  "address",
  "pictures",
  "picture",
  "thumbnail",
  "descriptions",
  "publicDescription",
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

function parseComboGroups() {
  if (!process.env.GUESTY_COMBO_GROUPS) return [];

  try {
    const groups = JSON.parse(process.env.GUESTY_COMBO_GROUPS);
    return Array.isArray(groups) ? groups : [];
  } catch (error) {
    throw new Error("GUESTY_COMBO_GROUPS must be valid JSON.");
  }
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

  if (query.get("bedrooms")) {
    search.set("numberOfBedrooms", query.get("bedrooms"));
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
  return String(listing._id || listing.id || listing.listingId || "");
}

function getImage(listing, fallbackImage) {
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
    fallbackImage ||
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=82"
  );
}

function getPrice(listings, group) {
  if (group.price) return Number(group.price);

  const nightlyRates = listings.flatMap((listing) => Object.values(listing.nightlyRates || {}));
  const numericRates = nightlyRates.map(Number).filter((rate) => Number.isFinite(rate) && rate > 0);

  if (numericRates.length > 0) {
    return Math.round(numericRates.reduce((total, rate) => total + rate, 0) / numericRates.length);
  }

  return listings.reduce((total, listing) => {
    const price = Number(listing.price || listing.prices?.basePrice || listing.prices?.base || 0);
    return total + price;
  }, 0);
}

function getSummary(listings, group) {
  if (group.summary) return group.summary;

  const [first, second] = listings;
  const firstTitle = first?.title || first?.nickname || "Unit A";
  const secondTitle = second?.title || second?.nickname || "Unit B";

  return `A transparent two-unit stay combining ${firstTitle} and ${secondTitle} for larger groups.`;
}

function createUnitRows(listings) {
  return listings.map((listing, index) => ({
    name: listing.title || listing.nickname || `Unit ${String.fromCharCode(65 + index)}`,
    detail: `${Number(listing.bedrooms || 0)} bedrooms, ${Number(listing.bathrooms || 0)} baths, sleeps ${Number(
      listing.accommodates || 0,
    )}`,
  }));
}

function buildCollections(listings, groups) {
  const listingsById = new Map(listings.map((listing) => [getListingId(listing), listing]));

  return groups.flatMap((group, index) => {
    const memberIds = Array.isArray(group.memberIds) ? group.memberIds.map(String) : [];
    const members = memberIds.map((id) => listingsById.get(id)).filter(Boolean);

    if (memberIds.length === 0 || members.length !== memberIds.length) {
      return [];
    }

    const amenities = [...new Set(members.flatMap((listing) => listing.amenities || []))].slice(0, 8);
    const bedrooms = members.reduce((total, listing) => total + Number(listing.bedrooms || 0), 0);
    const bathrooms = members.reduce((total, listing) => total + Number(listing.bathrooms || 0), 0);
    const guests = members.reduce((total, listing) => total + Number(listing.accommodates || 0), 0);
    const first = members[0] || {};

    return [
      {
        id: group.id || `guesty-combo-${index + 1}`,
        title: group.title || `${group.resort || first.address?.city || "Guesty"} ${bedrooms}-Bedroom Combo`,
        resort: group.resort || first.address?.city || "Guesty",
        location:
          group.location ||
          [first.address?.city, first.address?.state, first.address?.country].filter(Boolean).join(", ") ||
          "Guesty listing area",
        badge: group.badge || `Two-unit ${bedrooms}BR stay`,
        bedrooms,
        bathrooms,
        guests,
        price: getPrice(members, group),
        image: group.image || getImage(first),
        imageAlt: group.imageAlt || `${group.title || "Guesty combo stay"} vacation rental`,
        summary: getSummary(members, group),
        description:
          group.description ||
          "This Guesty-powered combo stay includes two separate nearby units. The quote process confirms both unit calendars before the stay is offered to a guest.",
        units: Array.isArray(group.units) && group.units.length > 0 ? group.units : createUnitRows(members),
        amenities: group.amenities || amenities,
        memberIds,
      },
    ];
  });
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
    const groups = parseComboGroups();

    if (groups.length === 0) {
      sendJson(response, 200, {
        source: "demo",
        collections: [],
        message: "Add GUESTY_COMBO_GROUPS to map two Guesty listings into each VacationRentalExpertz combo.",
      });
      return;
    }

    const query = getQuery(request);
    const token = await getToken(mode);
    const listings = await fetchGuestyListings(query, mode, token);
    const collections = buildCollections(listings, groups);

    sendJson(response, 200, {
      source: "guesty",
      collections,
      rawCount: listings.length,
      syncedAt: new Date().toISOString(),
      message:
        collections.length > 0
          ? ""
          : "Guesty returned listings, but no configured two-unit combo had every member available for this search.",
    });
  } catch (error) {
    sendJson(response, 500, {
      source: "demo",
      collections: [],
      message: error.message || "Guesty inventory could not be loaded.",
    });
  }
}
