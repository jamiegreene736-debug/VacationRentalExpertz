const catalogEndpoint = "/api/stays";

function normalizeCollection(stay) {
  const photos = Array.isArray(stay.photos) ? stay.photos.filter(Boolean) : [];
  const image = stay.image || photos[0] || "";

  return {
    id: String(stay.id || stay.title || crypto.randomUUID()),
    title: stay.title || stay.nickname || "Untitled stay",
    resort: stay.resort || stay.address?.city || "",
    location: stay.location || [stay.address?.city, stay.address?.state, stay.address?.country].filter(Boolean).join(", "),
    badge: stay.badge || "",
    bedrooms: Number(stay.bedrooms || 0),
    bathrooms: Number(stay.bathrooms || 0),
    guests: Number(stay.guests || stay.accommodates || 0),
    price: Number(stay.price || 0),
    image,
    photos: image ? [image, ...photos.filter((photo) => photo !== image)] : photos,
    imageAlt: stay.imageAlt || `${stay.title || "Stay"} vacation rental`,
    summary: stay.summary || "",
    description: stay.description || "",
    descriptionSections: Array.isArray(stay.descriptionSections)
      ? stay.descriptionSections.filter((section) => section?.text)
      : [],
    units: Array.isArray(stay.units) ? stay.units.filter((unit) => unit?.name || unit?.detail) : [],
    amenities: Array.isArray(stay.amenities) ? stay.amenities.filter(Boolean) : [],
    bookingUrl: stay.bookingUrl || "",
  };
}

export async function fetchStayCollections(search) {
  const params = new URLSearchParams();

  Object.entries(search).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const response = await fetch(`${catalogEndpoint}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
    },
  });

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error(
      "Live stays are temporarily unavailable.",
    );
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "Live stays could not be loaded.");
  }

  const collections = Array.isArray(payload.collections) ? payload.collections.map(normalizeCollection) : [];

  return { collections };
}
